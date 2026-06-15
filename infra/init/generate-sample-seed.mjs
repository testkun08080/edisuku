#!/usr/bin/env node
/**
 * Regenerate infra/init/seed-local-d1.sql and infra/init/sample/shareholders/9999.json
 * Run: node infra/init/generate-sample-seed.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const ANNUAL_FY = [2021, 2022, 2023, 2024, 2025];
const mult = [0.62, 0.71, 0.82, 0.91, 1.0];

/** Deterministic PRNG (mulberry32) — 再生成のたびに同じ分布 */
function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, min, max) {
  return min + rng() * (max - min);
}

function yen(n) {
  return String(Math.round(n));
}

function escSql(s) {
  return s.replace(/'/g, "''");
}

function j(obj) {
  return escSql(JSON.stringify(obj));
}

const sampleCompanies = [
  { edinetCode: "E00000", secCode: "9999", filerName: "サンプル株式会社", listedCategory: "上場", industry: "情報・通信業" },
  { edinetCode: "E00001", secCode: "1301", filerName: "カブトシステムズ株式会社", listedCategory: "上場", industry: "情報・通信業" },
  { edinetCode: "E00002", secCode: "1302", filerName: "ライオンロジスティクス株式会社", listedCategory: "上場", industry: "陸運業" },
  { edinetCode: "E00003", secCode: "1303", filerName: "ペンギンソリューションズ株式会社", listedCategory: "上場", industry: "サービス業" },
  { edinetCode: "E00004", secCode: "1304", filerName: "キツネクラウド株式会社", listedCategory: "上場", industry: "情報・通信業" },
  { edinetCode: "E00005", secCode: "1305", filerName: "クジラデータバンク株式会社", listedCategory: "上場", industry: "銀行業" },
  { edinetCode: "E00006", secCode: "1306", filerName: "ハリネズミファイナンス株式会社", listedCategory: "上場", industry: "その他金融業" },
  { edinetCode: "E00007", secCode: "1307", filerName: "フクロウメディア株式会社", listedCategory: "上場", industry: "情報・通信業" },
  { edinetCode: "E00008", secCode: "1308", filerName: "ラッコアセットマネジメント株式会社", listedCategory: "上場", industry: "証券、商品先物取引業" },
  { edinetCode: "E00009", secCode: "1309", filerName: "シロクマエナジー株式会社", listedCategory: "上場", industry: "電気・ガス業" },
  { edinetCode: "E00010", secCode: "1310", filerName: "ウサギテクノロジーズ株式会社", listedCategory: "上場", industry: "電気機器" },
];

/** 企業ごとにフィルター試験用の多様な財務プロファイルを生成 */
function buildCompanyProfiles() {
  return sampleCompanies.map((company, i) => {
    const rng = createRng(i * 9973 + 42);
    const salesBase = pick(rng, 25_000_000_000, 2_800_000_000_000);
    const equityRatio = pick(rng, 0.18, 0.72);
    const opMargin = pick(rng, 0.015, 0.24);
    const netMargin = opMargin * pick(rng, 0.45, 0.92);
    const roe = pick(rng, 0.025, 0.26);
    const per = pick(rng, 4.5, 42);
    const pbr = pick(rng, 0.35, 3.8);
    const shares = Math.round(pick(rng, 80_000_000, 750_000_000) / 1_000_000) * 1_000_000;
    const payoutRatio = pick(rng, 0.08, 0.62);
    const currentRatio = pick(rng, 0.75, 2.6);
    const icfToSales = -pick(rng, 0.02, 0.14);
    const fcfToSales = rng() > 0.35 ? pick(rng, 0.01, 0.11) : -pick(rng, 0.01, 0.06);
    const growthYoY = pick(rng, -0.12, 0.28);
    const cagr3y = pick(rng, -0.05, 0.22);
    const employeesBase = Math.round(pick(rng, 800, 45_000));
    const divGrowth = pick(rng, -0.05, 0.15);

    return {
      company,
      salesBase,
      equityRatio,
      opMargin,
      netMargin,
      roe,
      per,
      pbr,
      shares,
      payoutRatio,
      currentRatio,
      icfToSales,
      fcfToSales,
      growthYoY,
      cagr3y,
      employeesBase,
      divGrowth,
    };
  });
}

function buildBlocks(profile, scale, { headcountScale = 1 } = {}) {
  const sales = profile.salesBase * scale;
  const op = sales * profile.opMargin;
  const ord = op * pick(createRng(Math.round(sales) % 10000), 0.92, 0.99);
  const net = sales * profile.netMargin;
  const comp = net * 1.025;
  const eq = net / profile.roe;
  const ta = eq / profile.equityRatio;
  const liab = ta - eq;
  const cl = liab * pick(createRng(Math.round(eq) % 10000 + 1), 0.32, 0.58);
  const ca = cl * profile.currentRatio;
  const ocf = sales * pick(createRng(Math.round(sales) % 10000 + 2), 0.08, 0.18);
  const icf = sales * profile.icfToSales;
  const fcfFlow = sales * profile.fcfToSales;
  const cash = sales * pick(createRng(Math.round(sales) % 10000 + 3), 0.06, 0.22);
  const invSec = sales * pick(createRng(Math.round(sales) % 10000 + 4), 0.01, 0.08);
  const cogs = sales * (1 - profile.opMargin - pick(createRng(Math.round(sales) % 10000 + 5), 0.02, 0.08));
  const gross = sales - cogs;
  const sga = gross - op;
  const eps = (net / profile.shares).toFixed(2);
  const bps = (eq / profile.shares).toFixed(2);
  const dps = ((profile.payoutRatio * net) / profile.shares).toFixed(2);
  const employees = Math.max(100, Math.round(profile.employeesBase * headcountScale));
  const temp = Math.max(10, Math.round(employees * pick(createRng(Math.round(sales) % 10000 + 6), 0.15, 0.35)));
  const equityRatioStr = profile.equityRatio.toFixed(4);
  const roeStr = profile.roe.toFixed(4);

  const summary = {
    売上高: yen(sales),
    経常利益: yen(ord),
    包括利益: yen(comp),
    "親会社株主に帰属する当期純利益": yen(net),
    純資産額: yen(eq),
    総資産額: yen(ta),
    "１株当たり純資産額": bps,
    "１株当たり当期純利益又は当期純損失": eps,
    "潜在株式調整後１株当たり当期純利益": (parseFloat(eps) * 0.985).toFixed(2),
    自己資本比率: equityRatioStr,
    "自己資本利益率、経営指標等": roeStr,
    株価収益率: profile.per.toFixed(2),
    株価純資産倍率: profile.pbr.toFixed(2),
    営業活動によるキャッシュ・フロー: yen(ocf),
    投資活動によるキャッシュ・フロー: yen(icf),
    財務活動によるキャッシュ・フロー: yen(fcfFlow),
    現金及び現金同等物の残高: yen(cash),
    従業員数: String(employees),
    平均臨時雇用人員: String(temp),
    配当性向: profile.payoutRatio.toFixed(4),
    "１株当たり配当額": dps,
    "発行済株式総数（普通株式）": yen(profile.shares),
    資本金: yen(sales * 0.05),
  };
  const pl = {
    売上高: yen(sales),
    売上原価: yen(cogs),
    "売上総利益又は売上総損失（△)": yen(gross),
    "販売費及び一般管理費": yen(Math.max(sga, sales * 0.01)),
    営業利益: yen(op),
    経常利益: yen(ord),
    税引前利益: yen(ord * 0.98),
    "親会社株主に帰属する当期純利益": yen(net),
  };
  const bs = {
    総資産: yen(ta),
    流動資産: yen(ca),
    固定資産: yen(Math.max(ta - ca, 0)),
    負債: yen(liab),
    純資産: yen(eq),
    流動負債: yen(cl),
    固定負債: yen(Math.max(liab - cl, 0)),
    現金及び現金同等物: yen(cash),
    投資有価証券: yen(invSec),
  };
  const cf = {
    営業活動によるキャッシュ・フロー: yen(ocf),
    投資活動によるキャッシュ・フロー: yen(icf),
    財務活動によるキャッシュ・フロー: yen(fcfFlow),
    配当金の支払額: yen(-Math.abs(net * profile.payoutRatio)),
    現金及び現金同等物の期末残高: yen(cash),
  };
  return { summary, pl, bs, cf };
}

const companyProfiles = buildCompanyProfiles();
const profile9999 = companyProfiles[0];

/** @type {{ docId: string, docType: string, docDescription: string, periodStart: string, periodEnd: string, submit: string, scale: number }[]} */
const entries = [];

for (let i = 0; i < ANNUAL_FY.length; i++) {
  const fy = ANNUAL_FY[i];
  entries.push({
    docId: `SAMPLE-ANNUAL-${fy}`,
    docType: "annual",
    docDescription: "有価証券報告書",
    periodStart: `${fy - 1}-04-01`,
    periodEnd: `${fy}-03-31`,
    submit: `${fy}-06-28T09:00:00Z`,
    scale: mult[i],
  });
}

for (const fy of ANNUAL_FY) {
  const i = ANNUAL_FY.indexOf(fy);
  const m = mult[i];
  const qDefs = [
    { q: 1, end: `${fy - 1}-06-30`, start: `${fy - 1}-04-01`, frac: 0.22 },
    { q: 2, end: `${fy - 1}-09-30`, start: `${fy - 1}-07-01`, frac: 0.24 },
    { q: 3, end: `${fy - 1}-12-31`, start: `${fy - 1}-10-01`, frac: 0.26 },
    { q: 4, end: `${fy}-03-31`, start: `${fy}-01-01`, frac: 0.28 },
  ];
  for (const q of qDefs) {
    entries.push({
      docId: `SAMPLE-Q${q.q}-${fy}`,
      docType: "quarterly",
      docDescription: "四半期報告書",
      periodStart: q.start,
      periodEnd: q.end,
      submit: `${q.end.slice(0, 4)}-${q.q === 4 ? "05" : String(7 + q.q * 3).padStart(2, "0")}-15T09:00:00Z`,
      scale: m * q.frac * 4,
    });
  }
}

for (let i = 0; i < ANNUAL_FY.length; i++) {
  const fy = ANNUAL_FY[i];
  const m = mult[i];
  entries.push({
    docId: `SAMPLE-SEMI-${fy}`,
    docType: "semiannual",
    docDescription: "半期報告書",
    periodStart: `${fy - 1}-04-01`,
    periodEnd: `${fy - 1}-09-30`,
    submit: `${fy - 1}-11-14T09:00:00Z`,
    scale: m * 0.48,
  });
}

const lines = [
  "-- Generated by infra/init/generate-sample-seed.mjs — do not edit by hand.",
  "PRAGMA foreign_keys = ON;",
  "",
];

let documentCount = 0;
let periodCount = 0;

for (const company of sampleCompanies) {
  lines.push(`INSERT OR REPLACE INTO companies (
  edinet_code, sec_code, filer_name, listed_category, industry
) VALUES (
  '${company.edinetCode}', '${company.secCode}', '${company.filerName}', '${company.listedCategory}', '${company.industry}'
);`);
  lines.push("");
}

for (const e of entries) {
  lines.push(`INSERT OR REPLACE INTO documents (
  doc_id, edinet_code, sec_code, doc_type, ordinance_code, form_code, doc_type_code,
  period_start, period_end, submit_date_time, withdrawal_status, doc_description, source_meta_json
) VALUES (
  '${e.docId}', 'E00000', '9999', '${e.docType}',
  '010', '030000', '120', '${e.periodStart}', '${e.periodEnd}',
  '${e.submit}', '0', '${e.docDescription}',
  '{"source":"local-d1-seed"}'
);`);
  lines.push("");
  documentCount++;
}

for (const e of entries) {
  const blocks = buildBlocks(profile9999, e.scale, {
    headcountScale: 0.88 + (e.scale / 4) * 0.12,
  });
  lines.push(`INSERT OR REPLACE INTO period_financials (
  edinet_code, sec_code, doc_id, doc_type, period_start, period_end, submit_date_time, filer_name,
  summary_json, pl_json, bs_json, cf_json, raw_tsv_path
) VALUES (
  'E00000', '9999', '${e.docId}', '${e.docType}',
  '${e.periodStart}', '${e.periodEnd}', '${e.submit}', 'サンプル株式会社',
  '${j(blocks.summary)}',
  '${j(blocks.pl)}',
  '${j(blocks.bs)}',
  '${j(blocks.cf)}',
  NULL
);`);
  lines.push("");
  periodCount++;
}

/** 各 peer 会社: 2023–2025 の有報 3 期（成長率・CAGR フィルター用） */
const PEER_ANNUAL_FY = [2023, 2024, 2025];
for (let i = 1; i < companyProfiles.length; i++) {
  const profile = companyProfiles[i];
  const company = profile.company;
  let scale = 1;
  for (let y = PEER_ANNUAL_FY.length - 1; y >= 0; y--) {
    const fy = PEER_ANNUAL_FY[y];
    const docId = `SAMPLE-ANNUAL-${fy}-${company.secCode}`;
    const periodStart = `${fy - 1}-04-01`;
    const periodEnd = `${fy}-03-31`;
    const submit = `${fy}-06-28T09:00:00Z`;

    lines.push(`INSERT OR REPLACE INTO documents (
  doc_id, edinet_code, sec_code, doc_type, ordinance_code, form_code, doc_type_code,
  period_start, period_end, submit_date_time, withdrawal_status, doc_description, source_meta_json
) VALUES (
  '${docId}', '${company.edinetCode}', '${company.secCode}', 'annual',
  '010', '030000', '120', '${periodStart}', '${periodEnd}',
  '${submit}', '0', '有価証券報告書',
  '{"source":"local-d1-seed"}'
);`);
    lines.push("");
    documentCount++;

    const blocks = buildBlocks(profile, scale, { headcountScale: 0.9 + y * 0.03 });
    lines.push(`INSERT OR REPLACE INTO period_financials (
  edinet_code, sec_code, doc_id, doc_type, period_start, period_end, submit_date_time, filer_name,
  summary_json, pl_json, bs_json, cf_json, raw_tsv_path
) VALUES (
  '${company.edinetCode}', '${company.secCode}', '${docId}', 'annual',
  '${periodStart}', '${periodEnd}', '${submit}', '${escSql(company.filerName)}',
  '${j(blocks.summary)}',
  '${j(blocks.pl)}',
  '${j(blocks.bs)}',
  '${j(blocks.cf)}',
  NULL
);`);
    lines.push("");
    periodCount++;

    scale /= 1 + profile.growthYoY;
  }
}

for (const company of sampleCompanies) {
  const latestDocId =
    company.secCode === "9999" ? "SAMPLE-ANNUAL-2025" : `SAMPLE-ANNUAL-2025-${company.secCode}`;
  lines.push(`INSERT OR REPLACE INTO sec_code_latest_periods (
  sec_code, edinet_code, filer_name, latest_doc_id, latest_period_end, latest_submit_date_time
) VALUES (
  '${company.secCode}', '${company.edinetCode}', '${escSql(company.filerName)}',
  '${latestDocId}', '2025-03-31', '2025-06-28T09:00:00Z'
);`);
  lines.push("");
}

lines.push(`INSERT OR REPLACE INTO daily_metrics (
  snapshot_date, company_count, document_count, period_financial_count
) VALUES (
  '2025-06-28', ${sampleCompanies.length}, ${documentCount}, ${periodCount}
);`);
lines.push("");

const seedPath = join(root, "infra/init/seed-local-d1.sql");
writeFileSync(seedPath, `${lines.join("\n")}\n`);
console.log(`Wrote ${seedPath} (${periodCount} periods, ${documentCount} documents)`);

console.log("Sample profile ranges (latest FY, scale=1):");
for (const p of companyProfiles) {
  const salesM = Math.round(p.salesBase / 1_000_000);
  console.log(
    `  ${p.company.secCode}: sales=${salesM}百万 ROE=${(p.roe * 100).toFixed(1)}% EQ=${(p.equityRatio * 100).toFixed(1)}% PER=${p.per.toFixed(1)} PBR=${p.pbr.toFixed(2)} growthYoY=${(p.growthYoY * 100).toFixed(1)}%`,
  );
}

const holderNames = [
  "サンプルホールディングス株式会社",
  "日本サンプル年金基金",
  "サンプルキャピタルパートナーズ",
  "東京サンプル信託銀行（信託口）",
  "グローバル・インデックス・ファンド",
];
const holderBase = [
  { shares: 128_600_000, ratio: 29.91 },
  { shares: 43_000_000, ratio: 10.0 },
  { shares: 25_800_000, ratio: 6.0 },
  { shares: 21_500_000, ratio: 5.0 },
  { shares: 17_200_000, ratio: 4.0 },
];

const periodEnds = [...new Set(entries.map((e) => e.periodEnd))].sort();
const shareholders = {
  secCode: "9999",
  snapshots: periodEnds.map((periodEnd, idx) => {
    const doc = entries.find((e) => e.periodEnd === periodEnd);
    const bump = idx * 0.02;
    return {
      periodEnd,
      docId: doc?.docId ?? null,
      entries: holderBase.map((h, rank) => ({
        name: holderNames[rank],
        shares: Math.round(h.shares * (1 + bump * 0.1)),
        ratio: Number((h.ratio + bump).toFixed(2)),
      })),
    };
  }),
};

const sampleDir = join(root, "infra/init/sample/shareholders");
mkdirSync(sampleDir, { recursive: true });
const shPath = join(sampleDir, "9999.json");
writeFileSync(shPath, `${JSON.stringify(shareholders, null, 2)}\n`);
console.log(`Wrote ${shPath} (${periodEnds.length} snapshots)`);
