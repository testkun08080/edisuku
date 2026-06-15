/**
 * EDINET 等の出典表示用（利用条件・ライセンスに従って表示を更新してください）。
 * EDINET 側は apps/wrapper の取り込みパイプライン（API v2）と揃えています。
 */

/** apps/wrapper が利用する EDINET Web API v2 のベース URL */
export const EDINET_API_BASE = "https://api.edinet-fsa.go.jp/api/v2";

/** データ取り込みパイプライン（apps/wrapper）が呼び出す EDINET Web API */
export const DOCUMENTED_EDINET_ENDPOINTS = [
  {
    method: "GET" as const,
    path: "/documents.json",
    description: "提出書類一覧の取得（date / type / Subscription-Key クエリ）",
    fullUrlExample: `${EDINET_API_BASE}/documents.json`,
  },
  {
    method: "GET" as const,
    path: "/documents/{docID}",
    description: "提出書類本体の取得（type 等のクエリで提出種別に応じた取得）",
    fullUrlExample: `${EDINET_API_BASE}/documents/{docID}`,
  },
] as const;

/** ブラウザ上の本アプリが BFF 経由で取得する REST API（apps/api → D1） */
export const RUNTIME_API_PATHS = [
  { path: "/api/metrics", description: "スクリーナー用の企業指標一覧" },
  { path: "/api/metrics/query", description: "フィルタ・ソート・ページング付き指標クエリ" },
  {
    path: "/api/summaries/{証券コード}",
    description: "企業ごとの四半期サマリー・財務テーブル",
  },
  {
    path: "/api/shareholders/{証券コード}",
    description: "大株主の時系列データ",
  },
] as const;

export const LICENSE_AND_GUIDELINES = {
  pdm: {
    label: "公共データ利用規約 PDL1.0（デジタル庁）",
    url: "https://www.digital.go.jp/resources/open_data/public_data_license_v1.0",
  },
  disclosure2Guide: {
    label: "EDINET 書類のダウンロードに関する説明（金融庁・PDF）",
    url: "https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/download/ESE140206.pdf",
  },
  edinetPortal: {
    label: "EDINET（金融庁）",
    url: "https://disclosure.edinet-fsa.go.jp/",
  },
} as const;
