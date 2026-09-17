import { useData } from "vike-react/useData";
import { DataAttributionBlock } from "../../components/DataAttributionBlock";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { SITE_NAME } from "../../lib/brand";
import { GITHUB_REPO } from "../../lib/routes";
import type { Data } from "./+data";

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: import.meta.env.PUBLIC_ENV__SITE_URL || "https://edisuku.com",
  sameAs: [GITHUB_REPO],
  description:
    "EDINET の有価証券報告書を取得・解析し、Web スクリーナーで可視化するオープンソースの財務データプラットフォーム。",
};

export default function Page() {
  const { dataLastUpdated } = useData<Data>();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-auto p-4 lg:p-8">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: 構造化データの埋め込みに必要
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{SITE_NAME}について</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {SITE_NAME}は、EDINET
          に開示された有価証券報告書を誰でも無料で検索・比較できるように作られた、オープンソースの財務データプラットフォームです。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{SITE_NAME}とは</CardTitle>
          <CardDescription>
            個人投資家が決算資料を横断的に比較できるツールを目指しています。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            有価証券報告書には売上高・利益・キャッシュフロー・大株主構成など重要な情報が含まれていますが、企業ごとに
            PDF を探して読み比べるのは手間がかかります。{SITE_NAME}は、EDINET
            のデータを取得・解析し、複数期間・複数企業を横断して比較できる形に整えることで、この手間を減らすことを目的としています。
          </p>
          <p>
            上場企業3,900社以上、10年以上の財務データに対応し、ROE・PER・自己資本比率など20種類以上の指標でスクリーニングできます。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">オープンソースについて</CardTitle>
          <CardDescription>
            ソースコードは GitHub で MIT License のもと公開しています。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            計算ロジックやデータ取得パイプラインを含め、実装のすべてを
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              GitHub リポジトリ
            </a>
            で公開しています。指標の算出方法を誰でも検証できるようにすることが、財務データを扱うツールとしての透明性につながると考えています。フォークして自分の環境にデプロイすることも可能です。
          </p>
          <p>
            データ取り込みパイプラインは
            <a
              href="https://github.com/SakanaAI/edinet2dataset"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              SakanaAI/edinet2dataset
            </a>
            （Apache 2.0）を参考にしています。詳細は
            <a
              href={`${GITHUB_REPO}/blob/main/CREDITS.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              CREDITS.md
            </a>
            をご覧ください。
          </p>
        </CardContent>
      </Card>

      <DataAttributionBlock compact lastUpdated={dataLastUpdated ?? undefined} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">運営・お問い合わせ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            本サービスは個人開発者によって運営されているオープンソースプロジェクトです。ご質問・不具合報告・機能要望などは、
            <a href="/contact" className="text-primary underline-offset-4 hover:underline">
              お問い合わせページ
            </a>
            または GitHub の Issue からお寄せください。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">免責事項</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            本サービスが表示する情報は EDINET
            開示情報をもとに加工したものであり、正確性・完全性・最新性を保証するものではありません。投資その他の意思決定は、必ず
            EDINET
            に掲載されている一次資料をご確認のうえ、ご自身の判断と責任で行ってください。詳細は
            <a href="/privacy" className="text-primary underline-offset-4 hover:underline">
              プライバシーポリシー
            </a>
            をご覧ください。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
