import { getOfficersBySecCode } from "@edinet/db/queries";
import type { OfficerEntry, OfficersResponse } from "@edinet/types";
import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { getDb } from "../middleware/db.js";

export const officersRoutes = new Hono<AppEnv>().get("/:secCode", async (c) => {
  const secCode = c.req.param("secCode");
  const db = getDb(c);
  const rows = await getOfficersBySecCode(db, secCode);

  const body: OfficersResponse = {
    secCode,
    snapshots: rows.flatMap((r) => {
      try {
        return [
          {
            periodEnd: r.periodEnd,
            entries: JSON.parse(r.entriesJson) as OfficerEntry[],
          },
        ];
      } catch (err) {
        console.error("[api] invalid officer_snapshots.entries_json", {
          secCode,
          periodEnd: r.periodEnd,
          docId: r.docId,
          err,
        });
        return [];
      }
    }),
  };
  return c.json(body);
});
