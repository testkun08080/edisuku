import { getLatestDataSnapshotDate } from "@edinet/db";
import { METRICS_SCHEMA_VERSION, getScreenerColumns } from "@edinet/metrics";
import type { ManifestResponse } from "@edinet/types";
import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { getDb } from "../middleware/db.js";

export const manifestRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const dataLastUpdated = await getLatestDataSnapshotDate(getDb(c));
  const body: ManifestResponse = {
    columns: getScreenerColumns(),
    generatedAt: new Date().toISOString(),
    schemaVersion: c.env.API_VERSION ?? METRICS_SCHEMA_VERSION,
    dataLastUpdated,
  };
  return c.json(body);
});
