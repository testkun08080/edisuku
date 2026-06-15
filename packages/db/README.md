# @edinet/db

D1 / SQLite 用の Drizzle ORM スキーマと共通クエリです。

スキーマは `apps/wrapper/sql/d1_schema.sql` と対応しています（移行期間中の参照用に残置）。TypeScript スキーマからマイグレーションを生成します:

```bash
pnpm --filter @edinet/db db:generate
```

`apps/api` からの利用例:

```ts
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@edinet/db/schema";
import { getCompanyBySecCode } from "@edinet/db/queries";

const db = drizzle(env.EDISUKU_DB, { schema });
const company = await getCompanyBySecCode(db, "73180");
```
