# クラウド版マネタイズ実装プラン

作成日: 2026-06-12

モデル: **「セルフホスト無料 + クラウド版 Pro 課金」**（Plausible / Umami と同じ構造）

---

## 1. 無料 vs Pro の設計

| 機能 | セルフホスト | クラウド Free | クラウド Pro |
|---|:---:|:---:|:---:|
| 銘柄一覧・スクリーナー | ✓ | ✓ | ✓ |
| 全財務指標の閲覧 | ✓ | ✓ | ✓ |
| 日次データ更新 | 自分で管理 | ✓（自動） | ✓（自動） |
| **CSVエクスポート** | ✓ | — | ✓ |
| **スクリーナー条件の保存** | ✓ | — | ✓（クラウド同期） |
| **銘柄アラートメール** | — | — | ✓ |
| セットアップ | Cloudflare CLI + GH Actions | 不要 | 不要 |

**投資家ユーザーに「クラウド Free で毎日使って → アラートや保存が欲しくなったら Pro へ」という自然な流れを作る。**

---

## 2. 価格

| プラン | 月払い | 年払い |
|---|---|---|
| Free | ¥0 | ¥0 |
| **Pro** | **¥480/月** | **¥4,800/年**（2ヶ月分お得） |

### 収益試算

| 有料ユーザー数 | 月収 | 年収 |
|---|---|---|
| 10人 | ¥4,800 | ¥57,600 |
| 50人 | ¥24,000 | ¥288,000 |
| 100人 | ¥48,000 | ¥576,000 |
| 200人 | ¥96,000 | ¥1,152,000 |

バフェットコードの月額は ¥1,078。¥480 はその半値以下で乗り換え障壁が低い。

---

## 3. 課金・認証アーキテクチャ

**ライセンスキー方式（MVP として最もシンプル）**

```
ユーザーが Stripe で支払い
  → Stripe Webhook → Cloudflare Worker
  → ランダムなライセンスキーを生成
  → Cloudflare KV に保存 { key: "XXXX-XXXX-XXXX", active: true, email: "..." }
  → Resend でライセンスキーをメール送信
  → ユーザーがアプリ設定画面でキーを入力
  → /api/verify-license でKV照合
  → 有効なら localStorage に保存 → Pro機能アンロック
```

### なぜライセンスキー方式か

- セッション管理・JWTが不要 → 実装が最小
- Cloudflare Workers だけで完結（外部 Auth サービス不要）
- 同キーの共有リスクは ¥480 水準では実害が小さい
- 必要になったらデバイス制限を後から追加できる

### 使用サービス

| 用途 | サービス | 無料枠 |
|---|---|---|
| 決済 | **Stripe** | 手数料のみ（3.6% + ¥30） |
| メール送信 | **Resend** | 3,000通/月無料 |
| ライセンス保存 | **Cloudflare KV** | 10万件/日無料 |
| セッション補助 | **Cloudflare D1**（既存） | 5GB無料 |

---

## 4. 実装ロードマップ

### Phase 0 ― 今すぐ（コードゼロ）

- [ ] GitHub Sponsors を有効化し README にバッジ追加
- [ ] アクセストレードに登録申請（SBI証券 or 楽天証券）
- [ ] Stripe アカウント作成、¥480 Pro サブスク商品を作成

### Phase 1 ― CSV エクスポート Proゲート（2〜3日）

#### 新規追加

```
apps/api/src/routes/license.ts          ライセンス検証・発行エンドポイント
apps/web/lib/pro.ts                     Pro状態管理（localStorage読み書き）
apps/web/components/ProContext.tsx      グローバルPro状態
apps/web/components/LicenseKeyModal.tsx キー入力UI（設定画面 or モーダル）
```

#### 変更

```
apps/api/src/index.ts
  POST /api/verify-license    KV照合 → { valid: boolean }
  POST /api/webhooks/stripe   Stripe webhook → KV書き込み + Resendでメール送信

apps/web/components/TableDownloadButton.tsx
  Pro未加入なら「Pro にアップグレード」ダイアログを出す
```

#### Cloudflare KV スキーマ

```
キー:   "license:{XXXX-XXXX-XXXX-XXXX}"
値:     { active: true, email: "user@example.com", plan: "pro", createdAt: "..." }
```

### Phase 2 ― スクリーナー条件の保存（2〜3日）

```
apps/api/src/routes/saved-filters.ts   CRUD
packages/db/src/schema.ts              saved_filters テーブル追加
apps/web/components/FilterContext.tsx  ライセンスキーがあれば API と同期
```

### Phase 3 ― 銘柄アラートメール（1週間）

#### 何ができるか

- 「PER < 10 かつ ROE > 15%」のような条件を登録
- 日次更新後に自動評価
- 条件を満たす銘柄があったら Resend で通知メール送信

#### 追加するもの

```
packages/db/src/schema.ts              alerts テーブル
apps/api/src/routes/alerts.ts          CRUD
apps/wrapper/scripts/ingest_daily.py   更新後にアラート評価ロジックを追加
  → /api/internal/evaluate-alerts を呼ぶ
apps/api/src/routes/internal.ts        アラート評価 + Resend でメール送信
```

```sql
CREATE TABLE alerts (
  id          TEXT PRIMARY KEY,
  license_key TEXT NOT NULL,
  email       TEXT NOT NULL,
  conditions  TEXT NOT NULL,  -- JSON: [{ field, op, value }]
  created_at  TEXT NOT NULL
);
```

---

## 5. アフィリエイト設置箇所

| 場所 | 内容 |
|---|---|
| Landing page（`LandingFooter.tsx` 付近） | 「証券口座をお持ちでない方へ」CTA |
| スクリーナー詳細ページ | 銘柄ページの右サイドに「この銘柄を買う」リンク |
| プライバシーポリシーページ下部 | 免責表記に合わせて自然に配置 |

登録先: アクセストレード（SBI証券）→ 審査通過後にリンク発行

---

## 6. ランディングページの改修方針

Plausible のように「セルフホストできる = 信頼の証拠」を前面に出す。

```
現状: 「EDINETから財務データを取得するOSSスクリーナー」
改修: 「自分でホストできる / プライバシー重視 / 完全オープンソース
      → 管理不要で使いたい方はクラウド版へ」
```

`LandingHero.tsx` と `LandingOpenSource.tsx` に以下を追加:
- 「Cloud」vs「Self-host」の比較セクション
- 「¥480/月から」のCTAボタン
- GitHub Stars バッジ（信頼性の視覚化）

---

## 7. 全体スケジュール

| 週 | 作業 |
|---|---|
| Week 1 | Phase 0（登録系）+ Phase 1（CSV Pro ゲート）|
| Week 2 | Phase 2（条件保存）+ Landing page 改修 |
| Week 3 | Zenn 記事公開 + OSS リポジトリ公開 |
| Week 4〜 | Phase 3（アラートメール）|

---

## 8. 判断が必要な残課題

- [ ] ドメイン確定（`edisuku.dev`? `edisuku.jp`?）
- [ ] クラウド版 Free の「日次更新」は Cloudflare Workers 無料枠で賄えるか要確認（現在 10万 req/日）
- [ ] Pro ユーザーが増えたら D1 有料プランへの移行タイミングを設定
- [ ] 過去データ拡張（backfill 実装が前提のため Phase 3 以降に判断）
