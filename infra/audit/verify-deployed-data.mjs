#!/usr/bin/env node
/**
 * Verify deployed screener data against the metric definitions (read-only).
 *
 * Samples N companies from the live site and re-derives every computed metric
 * from the same EDINET fields the pipeline used, then reports disagreements.
 *
 * Usage:
 *   node infra/audit/verify-deployed-data.mjs
 *   node infra/audit/verify-deployed-data.mjs --sample 20 --seed 42
 *   node infra/audit/verify-deployed-data.mjs --base https://edisuku-web-staging.<sub>.workers.dev
 *   node infra/audit/verify-deployed-data.mjs --json report.json
 *
 * Reads the public site through the same BFF path the browser uses
 * (`/screener?_q=<resource>`), so no API key is needed.
 */

const DEFAULT_BASE = "https://edisuku.com";
const PAGE_SIZE = 500;

function parseArgs(argv) {
  const opts = { base: DEFAULT_BASE, sample: 20, seed: null, json: null, all: false };
  /** 値を伴うオプションで、値が無い／数値でない場合に黙って進まないようにする */
  const value = (i, name) => {
    const v = argv[i];
    if (v == null || v.startsWith("--")) {
      console.error(`[verify] ${name} に値が指定されていません`);
      process.exit(1);
    }
    return v;
  };
  const intValue = (i, name) => {
    const n = Number.parseInt(value(i, name), 10);
    if (!Number.isFinite(n)) {
      console.error(`[verify] ${name} には整数を指定してください: ${argv[i]}`);
      process.exit(1);
    }
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") opts.base = value(++i, "--base");
    else if (a === "--sample") opts.sample = intValue(++i, "--sample");
    else if (a === "--seed") opts.seed = intValue(++i, "--seed");
    else if (a === "--json") opts.json = value(++i, "--json");
    else if (a === "--all") opts.all = true;
    else if (a === "-h" || a === "--help") {
      console.log(
        [
          "Usage: node infra/audit/verify-deployed-data.mjs [options]",
          "  --base <url>    Site base URL (default: https://edisuku.com)",
          "  --sample <n>    Companies to deep-check (default: 20)",
          "  --seed <n>      Seed the sampler for a reproducible run",
          "  --all           Deep-check every company instead of a sample",
          "  --json <path>   Also write the findings as JSON",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  if (!Number.isFinite(opts.sample) || opts.sample < 1) opts.sample = 20;
  return opts;
}

/** Deterministic PRNG so a --seed run is reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function bff(base, resource) {
  const url = `${base.replace(/\/$/, "")}/screener?_q=${encodeURIComponent(resource)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${resource} -> HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${resource} -> non-JSON response (first 120 chars): ${text.slice(0, 120)}`);
  }
}

function num(raw) {
  if (raw == null || raw === "" || raw === "－") return null;
  const n = Number.parseFloat(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pick(period, ...keys) {
  for (const key of keys) {
    const v = period.summary?.[key] ?? period.pl?.[key] ?? period.bs?.[key] ?? period.cf?.[key];
    if (v != null && v !== "" && v !== "－") return v;
  }
  return null;
}

function reportKind(docDescription) {
  const d = docDescription ?? "";
  if (d.includes("四半期報告書")) return "四半期";
  if (d.includes("半期報告書")) return "半期";
  if (d.includes("有価証券報告書")) return "通期";
  return "その他";
}

function close(a, b, tol = 1e-6) {
  if (a == null || b == null) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / scale < tol;
}

async function fetchAllMetrics(base) {
  const rows = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total) {
    const body = await bff(base, `metrics?limit=${PAGE_SIZE}&offset=${offset}`);
    const page = body.rows ?? [];
    if (page.length === 0) break;
    rows.push(...page);
    total = body.total ?? rows.length;
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Re-derive metrics for one company and compare against what the site serves. */
function checkCompany(row, periods, shareholderSnapshots) {
  const findings = [];
  const sorted = [...periods].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const latest = sorted.find((p) => p.periodEnd === row.calcDate) ?? sorted.at(-1);
  const kind = latest ? reportKind(latest.docDescription) : "不明";

  const roic = num(row.roic);
  const roeCalc = num(row.roeCalculated);
  if (roic != null && roeCalc != null && close(roic, roeCalc, 1e-9)) {
    findings.push({
      id: "roic-equals-roe",
      severity: "high",
      detail: `ROIC(${roic.toFixed(6)}) が ROE(算出)(${roeCalc.toFixed(6)}) と同一`,
    });
  }

  const per = num(row.PER);
  const dps = num(row.dividendPerShare);
  const dy = num(row.dividendYield);
  if (dy != null && dps != null && per == null && close(dy, dps / 2500, 1e-9)) {
    findings.push({
      id: "dividend-yield-fabricated",
      severity: "high",
      detail: `配当利回り ${(dy * 100).toFixed(2)}% は株価2,500円決め打ちの推定値 (DPS ${dps})`,
    });
  }

  if (latest) {
    const cash = num(
      pick(
        latest,
        "現金及び現金同等物の残高",
        "現金及び現金同等物",
        "現金及び現金同等物の期末残高",
      ),
    );
    const liab = num(pick(latest, "負債"));
    const netCash = num(row.netCash);
    if (netCash != null && cash != null && liab != null) {
      if (close(netCash, cash - Math.round(liab * 0.35), 1e-6)) {
        findings.push({
          id: "netcash-magic-constant",
          severity: "high",
          detail: "ネットキャッシュが 現金 − 総負債×0.35 で算出 (有利子負債ではない)",
        });
      }
    }

    const bps = num(pick(latest, "１株当たり純資産額"));
    const pbr = num(row.PBR);
    const shares = num(pick(latest, "発行済株式総数（普通株式）", "発行済株式総数"));
    const mc = num(row.marketCap);
    if (mc != null && pbr != null && bps != null && shares != null && pbr * bps * shares !== 0) {
      const alt = pbr * bps * shares;
      const gap = Math.abs(mc - alt) / Math.abs(alt);
      if (gap > 0.05) {
        findings.push({
          id: "marketcap-inconsistent",
          severity: "medium",
          detail:
            `時価総額(配信値)=${(mc / 1e6).toFixed(0)}百万 vs ` +
            `PBR×BPS×株数=${(alt / 1e6).toFixed(0)}百万 (乖離 ${(gap * 100).toFixed(1)}%)`,
        });
      }
    }
  }

  if (kind !== "通期" && kind !== "不明") {
    findings.push({
      id: "interim-period-as-annual",
      severity: "high",
      detail: `一覧の売上高/利益/ROE が「${kind}」の数字（通期ではない）`,
    });
  }

  if (row.latestSubmitDateTime == null) {
    findings.push({ id: "submit-date-null", severity: "low", detail: "提出日が常に null" });
  }

  const emptyGrowth = [
    "salesGrowthYoY",
    "opGrowthYoY",
    "epsGrowthYoY",
    "dividendGrowthYoY",
    "salesCagr3y",
    "salesCagr5y",
    "consecutiveDivIncreases",
    "piotroskiFScore",
  ].filter((k) => row[k] == null);
  if (emptyGrowth.length > 0) {
    findings.push({
      id: "growth-metrics-missing",
      severity: emptyGrowth.length >= 6 ? "high" : "medium",
      detail: `未算出: ${emptyGrowth.join(", ")}`,
    });
  }

  if (shareholderSnapshots === 0) {
    findings.push({ id: "no-shareholders", severity: "high", detail: "大株主データ 0 件" });
  }

  const eq = num(row.equityRatio) ?? num(row.equityRatioCalculated);
  if (eq != null && (eq < 0 || eq > 1.5)) {
    findings.push({
      id: "equity-ratio-out-of-range",
      severity: "medium",
      detail: `自己資本比率の内部値が想定レンジ外: ${eq}`,
    });
  }

  return { kind, periodCount: periods.length, findings };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`[verify] base=${opts.base}`);

  const manifest = await bff(opts.base, "manifest").catch(() => null);
  if (manifest) {
    console.log(
      `[verify] schemaVersion=${manifest.schemaVersion} dataLastUpdated=${manifest.dataLastUpdated}`,
    );
  }

  const rows = await fetchAllMetrics(opts.base);
  console.log(`[verify] fetched ${rows.length} metric rows`);

  // ---- dataset-wide null rates -------------------------------------------
  const nullCounts = {};
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (v == null) nullCounts[k] = (nullCounts[k] ?? 0) + 1;
    }
  }
  console.log("\n=== 全 %d 行の欠損率（上位20） ===", rows.length);
  const ranked = Object.entries(nullCounts).sort((a, b) => b[1] - a[1]);
  for (const [k, n] of ranked.slice(0, 20)) {
    console.log(
      `  ${k.padEnd(26)} ${String(n).padStart(6)} / ${rows.length}  (${((n / rows.length) * 100).toFixed(1)}%)`,
    );
  }

  // ---- sample ------------------------------------------------------------
  const rand = opts.seed != null ? mulberry32(opts.seed) : Math.random;
  const pool = [...rows];
  const picked = [];
  const wanted = opts.all ? pool.length : Math.min(opts.sample, pool.length);
  while (picked.length < wanted && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  console.log(`\n=== 抽出 ${picked.length} 社を精査 ===`);

  const results = [];
  for (const row of picked) {
    let periods = [];
    let snapshots = null;
    try {
      const s = await bff(opts.base, `summaries/${row.secCode}`);
      periods = s.periods ?? [];
    } catch (e) {
      console.warn(`  ! ${row.secCode} summaries 取得失敗: ${e.message}`);
    }
    try {
      const sh = await bff(opts.base, `shareholders/${row.secCode}`);
      snapshots = (sh.snapshots ?? []).length;
    } catch {
      snapshots = null;
    }
    const r = checkCompany(row, periods, snapshots);
    results.push({ secCode: row.secCode, filerName: row.filerName, ...r });
    const flag = r.findings.length === 0 ? "指摘なし" : `指摘${r.findings.length}件`;
    console.log(
      `  ${row.secCode.padEnd(6)} ${String(row.filerName).slice(0, 20).padEnd(22)} ` +
        `期=${r.kind.padEnd(4)} 開示${String(r.periodCount).padStart(3)}件  ${flag}`,
    );
    for (const f of r.findings) {
      console.log(`      [${f.severity}] ${f.id}: ${f.detail}`);
    }
  }

  // ---- aggregate ---------------------------------------------------------
  const byId = {};
  for (const r of results) {
    for (const f of r.findings) {
      byId[f.id] = byId[f.id] ?? { severity: f.severity, companies: [] };
      byId[f.id].companies.push(r.secCode);
    }
  }
  console.log(`\n=== 指摘サマリ（${results.length}社中） ===`);
  const order = { high: 0, medium: 1, low: 2 };
  for (const [id, v] of Object.entries(byId).sort(
    (a, b) =>
      order[a[1].severity] - order[b[1].severity] || b[1].companies.length - a[1].companies.length,
  )) {
    console.log(
      `  [${v.severity.padEnd(6)}] ${id.padEnd(28)} ${v.companies.length}/${results.length} 社`,
    );
  }

  const kinds = {};
  for (const r of results) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  console.log("\n=== 一覧に載っている決算期の内訳 ===");
  for (const [k, n] of Object.entries(kinds)) console.log(`  ${k.padEnd(6)} ${n} 社`);

  if (opts.json) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      opts.json,
      `${JSON.stringify({ base: opts.base, total: rows.length, nullCounts, results }, null, 2)}\n`,
    );
    console.log(`\n[verify] wrote ${opts.json}`);
  }
}

main().catch((e) => {
  console.error(`[verify] failed: ${e.message}`);
  process.exit(1);
});
