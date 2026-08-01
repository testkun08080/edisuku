import { describe, expect, it } from "vitest";
import { metricsFromPeriods } from "./metricsFromPeriods.js";
import type { CompanySummary } from "./types.js";

const ANNUAL_FY = [2021, 2022, 2023, 2024, 2025];
const mult = [0.75, 0.82, 0.88, 0.94, 1.0];

function yen(n: number): string {
  return String(Math.round(n));
}

function buildBlocks(scale: number, perShareScale = scale) {
  const sales = 1_000_000_000_000 * scale;
  const op = 120_000_000_000 * scale;
  const ord = 115_000_000_000 * scale;
  const net = 80_000_000_000 * scale;
  const comp = 82_000_000_000 * scale;
  const ta = 2_500_000_000_000 * scale;
  const eq = 1_200_000_000_000 * scale;
  const liab = 1_300_000_000_000 * scale;
  const ca = 900_000_000_000 * scale;
  const cl = 500_000_000_000 * scale;
  const ocf = 150_000_000_000 * scale;
  const icf = -60_000_000_000 * scale;
  const fcf = -40_000_000_000 * scale;
  const cash = 200_000_000_000 * scale;
  const invSec = 45_000_000_000 * scale;
  const cogs = 700_000_000_000 * scale;
  const gross = 300_000_000_000 * scale;
  const sga = 180_000_000_000 * scale;
  const eps = (185.5 * perShareScale).toFixed(2);
  const bps = (2180 * Math.cbrt(scale)).toFixed(2);
  const dps = (50 * perShareScale).toFixed(2);
  const shares = 430_000_000;
  const equityRatio = (eq / ta).toFixed(4);
  const roe = (net / eq).toFixed(4);
  const payout = (0.3 + (scale - 0.75) * 0.15).toFixed(4);
  const per = (14 + (scale - 0.75) * 8).toFixed(2);
  const pbr = (1.05 + (scale - 0.75) * 0.5).toFixed(2);

  return {
    summary: {
      売上高: yen(sales),
      経常利益: yen(ord),
      包括利益: yen(comp),
      親会社株主に帰属する当期純利益: yen(net),
      純資産額: yen(eq),
      総資産額: yen(ta),
      "１株当たり純資産額": bps,
      "１株当たり当期純利益又は当期純損失": eps,
      自己資本比率: equityRatio,
      "自己資本利益率、経営指標等": roe,
      株価収益率: per,
      株価純資産倍率: pbr,
      営業活動によるキャッシュ・フロー: yen(ocf),
      投資活動によるキャッシュ・フロー: yen(icf),
      財務活動によるキャッシュ・フロー: yen(fcf),
      現金及び現金同等物の残高: yen(cash),
      配当性向: payout,
      "１株当たり配当額": dps,
      "発行済株式総数（普通株式）": yen(shares),
    },
    pl: {
      売上高: yen(sales),
      売上原価: yen(cogs),
      "売上総利益又は売上総損失（△)": yen(gross),
      販売費及び一般管理費: yen(sga),
      営業利益: yen(op),
      経常利益: yen(ord),
      親会社株主に帰属する当期純利益: yen(net),
    },
    bs: {
      総資産: yen(ta),
      流動資産: yen(ca),
      負債: yen(liab),
      純資産: yen(eq),
      流動負債: yen(cl),
      現金及び現金同等物: yen(cash),
      投資有価証券: yen(invSec),
    },
    cf: {
      営業活動によるキャッシュ・フロー: yen(ocf),
      投資活動によるキャッシュ・フロー: yen(icf),
      財務活動によるキャッシュ・フロー: yen(fcf),
      現金及び現金同等物の期末残高: yen(cash),
    },
  };
}

function buildGoldenCompany(): CompanySummary {
  const periods: CompanySummary["periods"] = [];
  for (let i = 0; i < ANNUAL_FY.length; i++) {
    const fy = ANNUAL_FY[i];
    const m = mult[i];
    const blocks = buildBlocks(m, m);
    periods.push({
      periodStart: `${fy - 1}-04-01`,
      periodEnd: `${fy}-03-31`,
      docID: `SAMPLE-ANNUAL-${fy}`,
      docDescription: annualDesc(fy),
      submitDateTime: `${fy}-06-28T09:00:00Z`,
      ...blocks,
    });
  }
  return {
    edinetCode: "E00000",
    secCode: "9999",
    filerName: "サンプル株式会社",
    periods,
  };
}

/** 実データの docDescription 形式（末尾に期・期間が付く） */
function annualDesc(fy: number): string {
  return `有価証券報告書－第${fy - 1947}期(${fy - 1}/04/01－${fy}/03/31)`;
}

/**
 * 通期・半期・四半期が混在する企業。実データ (9616 等) の構造を再現する。
 *
 * 半期報告書の periodEnd は「半期末」ではなく「期末日」なので通期と同一日付になる。
 * さらに翌期の半期報告書は、通期(有報)がまだ出ていない期末日を持つため
 * periodEnd ソートで最後尾に来る。これが「半期の6ヶ月分を通期として拾う」
 * 原因で、修正前は sorted.at(-1) がこの半期を選んでいた。
 */
function buildMixedFilingCompany(): CompanySummary {
  const periods: CompanySummary["periods"] = [];
  for (let i = 0; i < ANNUAL_FY.length; i++) {
    const fy = ANNUAL_FY[i];
    const m = mult[i];
    periods.push({
      ...buildBlocks(m, m),
      periodStart: `${fy - 1}-04-01`,
      periodEnd: `${fy}-03-31`,
      docID: `MIX-ANNUAL-${fy}`,
      docDescription: annualDesc(fy),
      submitDateTime: `${fy}-06-25T10:00:00Z`,
    });
    // 同一期の半期報告書（periodEnd は通期と同値）
    periods.push({
      ...buildBlocks(m * 0.5, m * 0.5),
      periodStart: `${fy - 1}-04-01`,
      periodEnd: `${fy}-03-31`,
      docID: `MIX-SEMI-${fy}`,
      docDescription: `半期報告書－第${fy - 1947}期(${fy - 1}/04/01－${fy}/03/31)`,
      submitDateTime: `${fy - 1}-11-12T11:00:00Z`,
    });
    periods.push({
      ...buildBlocks(m * 0.25, m * 0.25),
      periodStart: `${fy - 1}-10-01`,
      periodEnd: `${fy - 1}-12-31`,
      docID: `MIX-Q3-${fy}`,
      docDescription: `四半期報告書－第${fy - 1947}期第3四半期(${fy - 1}/10/01－${fy - 1}/12/31)`,
      submitDateTime: `${fy - 1}-02-10T09:00:00Z`,
    });
  }
  // 翌期の半期報告書のみ（対応する有報は未提出）。periodEnd 順では最後尾に来る。
  const nextFy = ANNUAL_FY[ANNUAL_FY.length - 1] + 1;
  periods.push({
    ...buildBlocks(0.52, 0.52),
    periodStart: `${nextFy - 1}-04-01`,
    periodEnd: `${nextFy}-03-31`,
    docID: `MIX-SEMI-${nextFy}`,
    docDescription: `半期報告書－第${nextFy - 1947}期(${nextFy - 1}/04/01－${nextFy}/03/31)`,
    submitDateTime: `${nextFy - 1}-11-12T12:00:00Z`,
  });
  return {
    edinetCode: "E00001",
    secCode: "9998",
    filerName: "混在サンプル株式会社",
    periods,
  };
}

/** 通期6期以上＋四半期を持つ長期履歴企業（CAGR の遡及検証用） */
function buildLongHistoryCompany(): CompanySummary {
  const periods: CompanySummary["periods"] = [];
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  for (let i = 0; i < years.length; i++) {
    const fy = years[i];
    const m = 0.6 + i * 0.07;
    periods.push({
      ...buildBlocks(m, m),
      periodStart: `${fy - 1}-04-01`,
      periodEnd: `${fy}-03-31`,
      docID: `LONG-ANNUAL-${fy}`,
      docDescription: annualDesc(fy),
      submitDateTime: `${fy}-06-28T09:00:00Z`,
    });
    periods.push({
      ...buildBlocks(m * 0.5, m * 0.5),
      periodStart: `${fy - 1}-10-01`,
      periodEnd: `${fy - 1}-12-31`,
      docID: `LONG-Q3-${fy}`,
      docDescription: `四半期報告書－第${fy - 1947}期第3四半期(${fy - 1}/10/01－${fy - 1}/12/31)`,
      submitDateTime: `${fy - 1}-02-10T09:00:00Z`,
    });
  }
  return {
    edinetCode: "E00002",
    secCode: "9997",
    filerName: "長期履歴サンプル株式会社",
    periods,
  };
}

describe("metricsFromPeriods", () => {
  it("computes golden fixture sales, ROE, EPS from sample 9999", () => {
    const company = buildGoldenCompany();
    const row = metricsFromPeriods(company);
    expect(row).not.toBeNull();
    expect(row!.sales).toBe("1000000000000");
    expect(row!.ROE).toBe("0.0667");
    expect(row!.EPS).toBe("185.50");
    expect(row!.secCode).toBe("9999");
    expect(row!.calcDate).toBe("2025-03-31");
  });

  it("computes consecutiveDivIncreases from rising DPS (not hardcoded 5)", () => {
    const company = buildGoldenCompany();
    const row = metricsFromPeriods(company);
    expect(row!.consecutiveDivIncreases).toBe(4);
    expect(row!.consecutiveDivIncreases).not.toBe(5);
  });

  it("computes piotroskiFScore from financials (not hardcoded 7)", () => {
    const company = buildGoldenCompany();
    const row = metricsFromPeriods(company);
    expect(row!.piotroskiFScore).not.toBe(7);
    expect(row!.piotroskiFScore).toBeTypeOf("number");
    expect(row!.piotroskiFScore).toBeGreaterThanOrEqual(0);
    expect(row!.piotroskiFScore).toBeLessThanOrEqual(9);
  });

  it("returns null for computed metrics when insufficient periods", () => {
    const company: CompanySummary = {
      edinetCode: "E00000",
      secCode: "9999",
      filerName: "サンプル株式会社",
      periods: [
        {
          ...buildBlocks(1.0),
          periodStart: "2024-04-01",
          periodEnd: "2025-03-31",
          docID: "ONE",
          docDescription: "有価証券報告書",
          submitDateTime: "2025-06-28T09:00:00Z",
        },
      ],
    };
    const row = metricsFromPeriods(company);
    expect(row!.consecutiveDivIncreases).toBeNull();
    expect(row!.piotroskiFScore).toBeNull();
  });

  it("computes YoY from same report kind only (not mixed semi-annual periods)", () => {
    const company: CompanySummary = {
      edinetCode: "E00000",
      secCode: "9999",
      filerName: "サンプル株式会社",
      periods: [
        {
          ...buildBlocks(0.5),
          periodStart: "2023-04-01",
          periodEnd: "2024-03-31",
          docID: "SEMI-1",
          docDescription: "半期報告書",
          submitDateTime: "2024-11-07T09:00:00Z",
        },
        {
          ...buildBlocks(1.0),
          periodStart: "2024-04-01",
          periodEnd: "2025-03-31",
          docID: "SEMI-2",
          docDescription: "半期報告書",
          submitDateTime: "2025-11-07T09:00:00Z",
        },
      ],
    };
    const row = metricsFromPeriods(company);
    const yoy = Number.parseFloat(row!.salesGrowthYoY!);
    expect(yoy).toBeCloseTo(1.0, 2);
  });

  it("uses filtered periods when options.periods is passed", () => {
    const company = buildGoldenCompany();
    const annualOnly = company.periods.filter((p) => p.docDescription?.includes("有価証券報告書"));
    const row = metricsFromPeriods(company, { periods: annualOnly });
    expect(row!.calcDate).toBe("2025-03-31");
    expect(row!.sales).toBe("1000000000000");
  });

  // 実データでは半期報告書の periodEnd が「半期末」ではなく「期末日」なので、
  // 同じ期の通期と半期が同一 periodEnd を持つ。periodEnd のソート順では
  // 区別できず、従来は後ろに来た半期(6ヶ月分)を通期として拾っていた。
  it("prefers the annual period when an interim report shares the same periodEnd", () => {
    const company = buildMixedFilingCompany();
    const row = metricsFromPeriods(company);
    expect(row!.reportKind).toBe("annual");
    expect(row!.sales).toBe(yen(1_000_000_000_000));
    expect(row!.calcDate).toBe("2025-03-31");
  });

  it("prefers the annual period regardless of input array order", () => {
    const company = buildMixedFilingCompany();
    const reversed: CompanySummary = { ...company, periods: [...company.periods].reverse() };
    const row = metricsFromPeriods(reversed);
    expect(row!.reportKind).toBe("annual");
    expect(row!.sales).toBe(yen(1_000_000_000_000));
  });

  it("never mixes interim periods into YoY when annual is selected", () => {
    const company = buildMixedFilingCompany();
    const row = metricsFromPeriods(company);
    // 通期 0.94 -> 1.0 の成長。半期(0.5)が混入すると桁違いの値になる
    expect(Number.parseFloat(row!.salesGrowthYoY!)).toBeCloseTo(1.0 / 0.94 - 1, 4);
  });

  it("falls back to semi-annual when no annual filing exists", () => {
    const company = buildMixedFilingCompany();
    const noAnnual: CompanySummary = {
      ...company,
      periods: company.periods.filter((p) => !p.docDescription.includes("有価証券報告書")),
    };
    const row = metricsFromPeriods(noAnnual);
    expect(row).not.toBeNull();
    expect(row!.reportKind).toBe("semiAnnual");
  });

  it("falls back to quarterly when only quarterly filings exist", () => {
    const company = buildMixedFilingCompany();
    const quarterOnly: CompanySummary = {
      ...company,
      periods: company.periods.filter((p) => p.docDescription.includes("四半期報告書")),
    };
    const row = metricsFromPeriods(quarterOnly);
    expect(row).not.toBeNull();
    expect(row!.reportKind).toBe("quarter");
  });

  it("keeps the analyze page toggle working via useProvidedPeriodsAsIs", () => {
    const company = buildMixedFilingCompany();
    const semiOnly = company.periods.filter((p) => p.docDescription.includes("半期報告書"));
    const row = metricsFromPeriods(company, {
      periods: semiOnly,
      useProvidedPeriodsAsIs: true,
    });
    expect(row!.reportKind).toBe("semiAnnual");
    // 最新の半期は翌期(2026-03-31)のもの
    expect(row!.calcDate).toBe("2026-03-31");
    expect(row!.sales).toBe(yen(1_000_000_000_000 * 0.52));
  });

  it("reports latestSubmitDateTime instead of always null", () => {
    const row = metricsFromPeriods(buildGoldenCompany());
    expect(row!.latestSubmitDateTime).toBe("2025-06-28T09:00:00Z");
  });

  it("returns null dividendYield instead of fabricating a 2500 yen share price", () => {
    const company = buildGoldenCompany();
    // PER を落とすと株価が判らなくなる。従来は dps/2500 を返していた
    const stripped: CompanySummary = {
      ...company,
      periods: company.periods.map((p) => {
        const { 株価収益率: _per, PER: _perAlias, ...summary } = p.summary;
        return { ...p, summary };
      }),
    };
    const row = metricsFromPeriods(stripped);
    const dps = Number.parseFloat(row!.dividendPerShare!);
    expect(dps).toBeGreaterThan(0);
    expect(row!.dividendYield).toBeNull();
    expect(row!.dividendYield).not.toBeCloseTo(dps / 2500, 6);
  });

  // バックフィルが LIMIT 6 で期間を切っていたため、通期が2〜3件しか残らず
  // salesCagr5y (at(-6) が必要) がほぼ全社 null になっていた。
  it("computes salesCagr5y only when enough annual periods survive the fetch window", () => {
    const company = buildLongHistoryCompany();
    const full = metricsFromPeriods(company);
    expect(full!.salesCagr5y).not.toBeNull();

    // periodEnd 降順の上位6件だけ渡す = 修正前のバックフィルが見ていた窓
    const narrowed = [...company.periods]
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
      .slice(0, 6);
    const starved = metricsFromPeriods({ ...company, periods: narrowed });
    expect(starved!.salesCagr5y).toBeNull();
  });

  it("dedupes repeated periodEnd+kind so lookbacks are not silently compressed", () => {
    const company = buildGoldenCompany();
    const withDupes: CompanySummary = {
      ...company,
      periods: [...company.periods, ...company.periods],
    };
    const row = metricsFromPeriods(withDupes);
    expect(row!.salesGrowthYoY).toBe(metricsFromPeriods(company)!.salesGrowthYoY);
  });
});
