# 仕様書: CSV エクスポート（Proゲート）+ AI チャット分析（Proゲート）

作成日: 2026-06-12  
対象ブランチ: `feature/pro-csv-chat`

---

## 0. スコープ

| 機能 | 場所 | ログイン必須 | Pro 必須 |
|---|---|:---:|:---:|
| スクリーナー一覧 CSV エクスポート | `/screener` | ✓ | ✓ |
| 企業分析ページ CSV エクスポート（新規） | `/screener/analyze/:secCode` | ✓ | ✓ |
| AI チャット分析（新規タブ） | `/screener/analyze/:secCode` | ✓ | Free 3回/Pro 20回 |

---

## 1. 認証システム（Clerk）

### 1-1. 採用理由

- Google OAuth + メール+パスワードを数行で実装できる
- UI コンポーネント付属（ログインモーダル等）
- 月 10,000 MAU まで無料
- Cloudflare Workers（`nodejs_compat` 済み）での動作実績あり

### 1-2. 全体フロー

```
ユーザーが「ログイン」ボタンを押す
  ↓
Clerk モーダル表示
  ├── [G] Google でログイン
  └── メール + パスワード
  ↓
認証成功 → Clerk が JWT をブラウザに保持
  ↓
API リクエスト時に Authorization: Bearer {jwt} を付与
  ↓
Worker が JWT を検証 → userId（Clerk の sub）を取得
  ↓
userId で KV の Pro ステータスを照合
```

### 1-3. 追加パッケージ

```bash
# apps/web
pnpm add @clerk/clerk-react

# apps/api
pnpm add @clerk/backend
```

### 1-4. 環境変数の追加

**`apps/web/wrangler.jsonc`:**
```jsonc
{
  "vars": {
    "PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_live_xxxx"
  }
}
```

**`apps/api/wrangler.toml`:**
```toml
[vars]
CLERK_PUBLISHABLE_KEY = "pk_live_xxxx"

# secrets（wrangler secret put で設定）
# CLERK_SECRET_KEY
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET
# ANTHROPIC_API_KEY
# RESEND_API_KEY
```

**`apps/api/src/env.ts` への追記:**
```typescript
interface Bindings {
  // 既存...
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
}

interface Variables {
  requestId: string;
  db: DB;
  userId: string;          // 追加: Clerk の sub
  isPro: boolean;          // 追加: Pro ステータス
}
```

---

### 1-5. フロントエンド実装

#### `apps/web/pages/+Layout.tsx` への追加

```tsx
import { ClerkProvider, SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/clerk-react";

// ClerkProvider を最上位に追加
export default function Layout({ children }) {
  return (
    <ClerkProvider publishableKey={import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <ProProvider>              {/* 後述 */}
        {/* 既存の Provider 群 */}
        {children}
      </ProProvider>
    </ClerkProvider>
  );
}
```

#### ヘッダーへのログインボタン追加

```tsx
// apps/web/components/AppHeader（既存）に追加
import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/clerk-react";

// ヘッダー右端:
<SignedOut>
  <SignInButton mode="modal">
    <Button variant="outline" size="sm">ログイン</Button>
  </SignInButton>
</SignedOut>
<SignedIn>
  <ProBadge />       {/* Pro の場合にバッジ表示 */}
  <UserButton />     {/* アバター + メニュー */}
</SignedIn>
```

---

### 1-6. APIミドルウェア

#### `apps/api/src/middleware/clerkAuth.ts`（新規）

```typescript
import { createClerkClient } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";

/** JWT を検証して c.var.userId をセットする */
export const clerkAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });

  try {
    const payload = await clerk.verifyToken(token, {
      authorizedParties: [c.env.CORS_ORIGIN],
    });
    c.set("userId", payload.sub);
  } catch {
    return c.json({ error: "invalid_token" }, 401);
  }

  return next();
};
```

#### `apps/api/src/middleware/proStatus.ts`（新規）

```typescript
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";

export interface ProStatusData {
  active: boolean;
  plan: "pro";
  stripeCustomerId?: string;
  activatedAt: string;
}

/** KV から Pro ステータスを読んで c.var.isPro をセットする */
export const proStatusMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = c.get("userId");
  const kv = c.env.EDISUKU_CACHE;

  const raw = kv ? await kv.get(`pro_status:${userId}`) : null;
  const status: ProStatusData | null = raw ? JSON.parse(raw) : null;

  c.set("isPro", status?.active === true);
  return next();
};
```

#### `apps/api/src/index.ts` へのルート追加

```typescript
// 認証が必要なルートグループ
const authedApp = new Hono<AppEnv>()
  .use("*", clerkAuthMiddleware)
  .use("*", proStatusMiddleware)
  .route("/analyze", analyzeChatRoutes)
  .route("/stripe", stripeRoutes)

// Stripe webhook は署名検証で守る（Clerk auth は不要）
app
  .route("/api/webhooks/stripe", stripeWebhookRoutes)
  .route("/api", authedApp)
  // 既存ルート...
```

---

## 2. Pro ステータス管理（KV）

### KV スキーマ

| キー | 値 | 説明 |
|---|---|---|
| `pro_status:{clerkUserId}` | `ProStatusData` JSON | Pro 有効フラグ |
| `chat_usage:{clerkUserId}:{YYYY-MM}` | `{ count: number }` JSON | チャット月次使用回数 |
| `chat_usage:anon:{ip}:{YYYY-MM}` | `{ count: number }` JSON | 未ログイン Free 使用回数 |

### フロントエンドの Pro 状態管理

#### `apps/web/lib/pro.ts`（簡略化）

```typescript
// Clerk の useUser() と API チェックで Pro 状態を判定するだけ
// localStorage へのキャッシュは 1 時間で十分（再検証コストが低いため）
export const PRO_CACHE_KEY = "edisuku_pro_cache";
export const PRO_CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

export interface ProCache {
  isPro: boolean;
  checkedAt: string;
}
```

#### `apps/web/components/ProContext.tsx`

```typescript
interface ProContextValue {
  isPro: boolean;
  loading: boolean;
}

export function ProProvider({ children }) {
  const { isSignedIn, getToken } = useAuth();    // Clerk
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) { setIsPro(false); setLoading(false); return; }

    // 1時間キャッシュ
    const cached = loadProCache();
    if (cached) { setIsPro(cached.isPro); setLoading(false); return; }

    // API で確認
    getToken().then(token =>
      fetch("/api/pro/status", { headers: { Authorization: `Bearer ${token}` } })
    ).then(r => r.json())
     .then(data => {
       setIsPro(data.isPro);
       saveProCache({ isPro: data.isPro, checkedAt: new Date().toISOString() });
     })
     .finally(() => setLoading(false));
  }, [isSignedIn]);

  return <ProContext.Provider value={{ isPro, loading }}>{children}</ProContext.Provider>;
}
```

---

## 3. 支払い（Stripe）

### フロー

```
ユーザーが「Pro にアップグレード」をクリック
  ↓
POST /api/stripe/create-checkout
  Headers: Authorization: Bearer {jwt}
  Body: { priceId: "price_xxxx", successUrl, cancelUrl }
  ↓
Worker: Stripe Checkout Session を作成
  metadata: { clerkUserId: userId }
  ↓
Stripe のホスト決済ページにリダイレクト
  ↓
支払い完了 → successUrl にリダイレクト
  ↓（非同期）
Stripe Webhook → POST /api/webhooks/stripe
  event: checkout.session.completed
  ↓
Worker:
  clerkUserId = event.data.object.metadata.clerkUserId
  kv.put(`pro_status:${clerkUserId}`, JSON.stringify({ active: true, plan: "pro", ... }))
  Resend でアクティベート完了メールを送信
```

### 新規ファイル

#### `apps/api/src/routes/stripe.ts`

```typescript
// POST /api/stripe/create-checkout
// POST /api/stripe/create-portal   （解約・プラン変更用）
```

#### `apps/api/src/routes/stripe-webhook.ts`

```typescript
// POST /api/webhooks/stripe
// Stripe-Signature ヘッダーで署名検証
// checkout.session.completed → KV 更新 + Resend でメール
// customer.subscription.deleted → KV 更新（isPro: false）
```

### Stripe 商品設定

| 項目 | 値 |
|---|---|
| 商品名 | エディスク Pro |
| 月額 | ¥480 |
| 年額 | ¥4,800 |
| 通貨 | JPY |

---

## 4. CSV エクスポート

### 4-1. スクリーナー一覧（既存コンポーネントへのゲート追加）

**`apps/web/components/TableDownloadButton.tsx` の変更:**

```typescript
const { isSignedIn } = useUser();    // Clerk

const { isPro } = usePro();           // ProContext

const handleDownload = useCallback(async () => {
  if (!isSignedIn) {
    openSignIn();
    return;
  }
  if (!isPro) {
    openUpgradeModal();   // Pro アップグレードモーダルを表示
    return;
  }
  // 既存の CSV ダウンロード処理（Pro ユーザーのみ到達）
}, [...]);
```

### 4-2. 企業分析ページ（新規）

分析ページの各タブデータを CSV で出力する。

#### ダウンロード対象

| タブ | 内容 | ファイル名 |
|---|---|---|
| サマリー | `filteredPeriods[n].summary` 全行 | `{secCode}_{企業名}_summary_{日付}.csv` |
| 指標 | `INDICATOR_KEYS` 全行（最新期） | `{secCode}_{企業名}_indicators_{日付}.csv` |
| 損益計算書 | `filteredPeriods[n].pl` | `{secCode}_{企業名}_pl_{日付}.csv` |
| 貸借対照表 | `filteredPeriods[n].bs` | `{secCode}_{企業名}_bs_{日付}.csv` |
| CF 計算書 | `filteredPeriods[n].cf` | `{secCode}_{企業名}_cf_{日付}.csv` |

#### CSV フォーマット

```
BOM 付き UTF-8（Excel で文字化けしない）
行 1: ヘッダー行（「項目」, 「2024-03-31」, 「2023-03-31」, ...）
行 2〜: データ行
```

#### 新規ファイル: `apps/web/lib/analyzeExport.ts`

```typescript
export type ExportTab = "summary" | "indicators" | "pl" | "bs" | "cf";

export function buildAnalyzeCsv(input: {
  tab: ExportTab;
  periods: FilteredPeriod[];
  metrics: CompanyMetricsRow | null;
}): string { ... }

export function analyzeExportFilename(params: {
  secCode: string;
  filerName: string;
  tab: ExportTab;
}): string { ... }
```

#### ボタン配置

タブヘッダー右端（AI チャットタブ表示中は非表示）:

```
[有報] [四半期]  [3年] [5年] [10年]   [⬇ CSV]
```

---

## 5. AI チャット分析

### 5-1. UI

#### タブ追加

```tsx
<TabsTrigger value="chat">
  <Sparkles className="size-3.5" />
  AI 分析
</TabsTrigger>
```

タブ順: サマリー → 指標 → 大株主 → 損益 → BS → CF → **AI 分析**

#### チャットレイアウト

```
+------------------------------------------------+
| AI 分析                    残り 17 回 / 20 回  |
+------------------------------------------------+
| ⚠️ 本チャットは EDINET 開示情報をもとにした    |
|    自動分析です。投資判断はご自身で行ってください |
+------------------------------------------------+
|                                                |
|  [AI] この企業の財務状況について質問してください |
|                                                |
|  [User] ROEが下がっている理由は？              |
|                                                |
|  [AI] ▌（ストリーミング）                      |
+------------------------------------------------+
| [入力欄                        ] [↑送信]       |
+------------------------------------------------+
```

#### 未ログイン時の表示

```
+------------------------------------------------+
| 🔒 AI 分析を使うにはログインが必要です          |
| [ログイン / 新規登録]                           |
+------------------------------------------------+
```

#### ログイン済み・Free ユーザーの表示

```
+------------------------------------------------+
| 無料プランのご利用 – 今月あと 2 回使えます      |
| より多く使うには → [Pro にアップグレード ¥480/月] |
+------------------------------------------------+
| （チャット UI は表示、3 回消費後はブロック）     |
```

### 5-2. フロントエンドの実装

#### 新規ファイル: `apps/web/components/AnalysisChat.tsx`

**Props:**
```typescript
interface AnalysisChatProps {
  secCode: string;
  filerName: string;
  metrics: CompanyMetricsRow | null;
  periods: FilteredPeriod[];
}
```

**送信フロー:**
```typescript
const { getToken, isSignedIn } = useAuth();   // Clerk

const sendMessage = async (userMessage: string) => {
  // 1. messages に追加
  // 2. streaming = true
  // 3. fetch POST /api/analyze/:secCode/chat
  //    headers: { Authorization: `Bearer ${await getToken()}` }
  //    body: { messages, context: { metrics, periods } }
  // 4. ReadableStream を読みながら assistantMessage を更新
  // 5. 完了 → streaming = false, usageCount++
  // 6. 429 → limitReached = true
};
```

**Enter で送信、Shift+Enter で改行:**
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(input);
  }
};
```

### 5-3. API エンドポイント

#### `POST /api/analyze/:secCode/chat`

**認証:** `clerkAuthMiddleware`（userId 取得）+ `proStatusMiddleware`（isPro 取得）

**リクエストボディ:**
```typescript
{
  messages: { role: "user" | "assistant"; content: string }[];
  context: {
    indicators: Record<string, unknown>;   // metrics の非 null フィールド
    periods: Record<string, unknown>[];    // filteredPeriods の summary（最大5期）
  };
}
```

**レスポンス:** `Content-Type: text/event-stream`

```
data: {"delta":"分析"}\n\n
data: {"delta":"します"}\n\n
data: {"done":true,"usageCount":3}\n\n
```

**エラー:**

| ステータス | 意味 |
|---|---|
| 401 | 未ログイン |
| 429 | 月間使用上限超過 `{ error: "rate_limit", limit: 20, used: 20 }` |
| 503 | Anthropic API タイムアウト |

**レート制限:**

```typescript
const limit = isPro ? 20 : 3;
const usageKey = `chat_usage:${userId}:${yearMonth}`;
const raw = await kv.get(usageKey);
const usage = raw ? JSON.parse(raw) : { count: 0 };

if (usage.count >= limit) {
  return c.json({ error: "rate_limit", limit, used: usage.count }, 429);
}

// レスポンス完了後にカウントをインクリメント
await kv.put(usageKey, JSON.stringify({ count: usage.count + 1 }), {
  expiration: firstSecondOfNextMonth(),
});
```

**System Prompt:**
```
あなたは日本の個人投資家向けの財務アナリストです。
以下の上場企業の財務データ（金融庁 EDINET の開示情報をもとに算出）を参照して、
ユーザーの質問に日本語で簡潔に回答してください。

# 企業情報
企業名: {filerName}
証券コード: {secCode}

# 最新期の主要指標
{indicators_json}

# 直近 N 期の財務推移（百万円）
{periods_json}

# 注意事項
- 投資判断の最終責任はユーザー本人にあります。
- 「買い」「売り」の断定的推奨は避けてください。
- データが存在しない項目は「データなし」と回答してください。
```

**使用モデル:** `claude-haiku-4-5-20251001`（コスト最小）  
**max_tokens:** `1024`

#### 新規ファイル: `apps/api/src/routes/analyze-chat.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";

export const analyzeChatRoutes = new Hono<AppEnv>()
  .post("/:secCode", async (c) => {
    const userId = c.get("userId");
    const isPro = c.get("isPro");
    // レート制限 → System Prompt 構築 → Anthropic SSE ストリーミング
  });
```

---

## 6. 追加する API エンドポイント一覧

| Method | Path | 認証 | 説明 |
|---|---|---|---|
| `GET` | `/api/pro/status` | Clerk JWT | Pro ステータス確認 |
| `POST` | `/api/stripe/create-checkout` | Clerk JWT | Stripe Checkout Session 作成 |
| `POST` | `/api/stripe/create-portal` | Clerk JWT | Stripe Customer Portal URL 取得 |
| `POST` | `/api/webhooks/stripe` | Stripe 署名 | 支払い完了 → KV 更新 |
| `POST` | `/api/analyze/:secCode/chat` | Clerk JWT | チャット SSE |

---

## 7. 実装チェックリスト

### Phase A: 認証基盤（1日）

- [ ] `@clerk/clerk-react` を `apps/web` に追加
- [ ] `@clerk/backend` を `apps/api` に追加
- [ ] Clerk ダッシュボードで Google OAuth を有効化
- [ ] `ClerkProvider` を `+Layout.tsx` に追加
- [ ] ヘッダーにログイン/ユーザーボタンを追加
- [ ] `clerkAuthMiddleware` を実装
- [ ] `proStatusMiddleware` を実装
- [ ] `ProProvider` / `usePro()` を実装
- [ ] `GET /api/pro/status` を実装
- [ ] 環境変数を wrangler.toml / wrangler.jsonc に追加

### Phase B: Stripe 支払い（1日）

- [ ] Stripe ダッシュボードで商品・価格を作成（¥480/月・¥4,800/年）
- [ ] `POST /api/stripe/create-checkout` を実装
- [ ] `POST /api/stripe/create-portal` を実装
- [ ] `POST /api/webhooks/stripe` を実装（KV 更新 + Resend メール）
- [ ] `UpradeModal.tsx` を実装（Pro でない場合に表示）
- [ ] 支払い完了後の Pro 解放を確認

### Phase C: CSV エクスポート（1日）

- [ ] `TableDownloadButton.tsx` に Clerk ログイン + Pro ゲートを追加
- [ ] `INDICATOR_KEYS` を `+Page.tsx` から `export`
- [ ] `analyzeExport.ts` を実装
- [ ] 分析ページにタブ別 CSV ボタンを追加（Pro ゲート付き）
- [ ] BOM 付き UTF-8 で Excel 文字化けないことを確認

### Phase D: AI チャット（1.5日）

- [ ] `AnalysisChat.tsx` を実装
- [ ] `+Page.tsx` に「AI 分析」タブを追加
- [ ] `analyze-chat.ts` エンドポイントを実装
- [ ] KV レート制限を実装
- [ ] `ANTHROPIC_API_KEY` を wrangler secret に設定
- [ ] Free 3 回 → 4 回目ブロックを確認
- [ ] Pro 20 回制限を確認
- [ ] 企業切り替えでチャット履歴がリセットされることを確認

### Phase E: 動作確認

- [ ] 未ログインで CSV ボタン → Clerk モーダルが開く
- [ ] ログイン済み・非 Pro で CSV → アップグレードモーダルが開く
- [ ] Stripe 決済完了 → Pro 解放（KV 更新確認）
- [ ] Pro で CSV ダウンロード成功
- [ ] 未ログインでチャット → ログイン促進 UI
- [ ] Free チャット 3 回 → 4 回目は 429
- [ ] サブスクキャンセル → Pro 解除確認
