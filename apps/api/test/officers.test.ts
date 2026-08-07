import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";

const sampleSnapshots = [
  {
    secCode: "6701",
    periodEnd: "2025-03-31",
    docId: "S100VZ85",
    entriesJson: JSON.stringify([
      {
        name: "森田隆之",
        title: "取締役代表執行役社長兼CEO",
        birthDate: "1959-03-05",
        roleGroup: "directors",
      },
      {
        name: "岡昌志",
        title: "取締役",
        birthDate: "1955-07-11",
        roleGroup: "directors",
      },
    ]),
    updatedAt: "2025-06-28T00:00:00.000Z",
  },
];

vi.mock("@edinet/db/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@edinet/db/queries")>();
  return {
    ...actual,
    getOfficersBySecCode: vi.fn(),
  };
});

import * as queries from "@edinet/db/queries";

const env = {
  EDISUKU_DB: undefined as unknown as D1Database,
  CORS_ORIGIN: "http://localhost:3000",
  API_VERSION: "test",
  INTERNAL_API_KEY: "test-secret",
  NODE_ENV: "development",
};

const authHeaders = { "X-Internal-Api-Key": "test-secret" };

describe("GET /api/officers/:secCode", () => {
  beforeEach(() => {
    vi.mocked(queries.getOfficersBySecCode).mockReset();
  });

  it("returns snapshots from D1 rows", async () => {
    vi.mocked(queries.getOfficersBySecCode).mockResolvedValue(sampleSnapshots);

    const res = await app.request("/api/officers/6701", { headers: authHeaders }, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      secCode: string;
      snapshots: Array<{
        periodEnd: string;
        entries: Array<{ name: string; birthDate: string | null; roleGroup: string }>;
      }>;
    };

    expect(body.secCode).toBe("6701");
    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshots[0]?.entries[0]?.name).toBe("森田隆之");
    expect(body.snapshots[0]?.entries[0]?.birthDate).toBe("1959-03-05");
    expect(body.snapshots[0]?.entries[0]?.roleGroup).toBe("directors");
  });

  it("returns empty snapshots when none exist", async () => {
    vi.mocked(queries.getOfficersBySecCode).mockResolvedValue([]);

    const res = await app.request("/api/officers/0000", { headers: authHeaders }, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { secCode: string; snapshots: unknown[] };
    expect(body.secCode).toBe("0000");
    expect(body.snapshots).toEqual([]);
  });

  it("skips snapshots with malformed entries_json", async () => {
    vi.mocked(queries.getOfficersBySecCode).mockResolvedValue([
      {
        ...sampleSnapshots[0]!,
        periodEnd: "2024-03-31",
        entriesJson: "{not-json",
      },
      sampleSnapshots[0]!,
    ]);

    const res = await app.request("/api/officers/6701", { headers: authHeaders }, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      snapshots: Array<{ periodEnd: string; entries: unknown[] }>;
    };
    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshots[0]?.periodEnd).toBe("2025-03-31");
    expect(body.snapshots[0]?.entries[0]).toMatchObject({ name: "森田隆之" });
  });
});
