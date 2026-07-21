import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { GITHUB_REPO } from "../../lib/routes";

type FaqItem = {
  question: string;
  /** 構造化データ（FAQPage）に埋め込むプレーンテキスト版の回答 */
  answerText: string;
  /** 画面表示用（リンク付き）の回答 */
  answer: React.ReactNode;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "データはどこから取得していますか？",
    answerText:
      "金融庁が運営する EDINET（Electronic Disclosure for Investors' NETwork）で開示されている有価証券報告書・四半期報告書・半期報告書等をもとに、数値を抽出・加工して表示しています。",
    answer: (
      <p>
        金融庁が運営する
        <a
          href="https://disclosure2.edinet-fsa.go.jp/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          EDINET（Electronic Disclosure for Investors&apos; NETwork）
        </a>
        で開示されている有価証券報告書・四半期報告書・半期報告書等をもとに、数値を抽出・加工して表示しています。
      </p>
    ),
  },
  {
    question: "何社くらいのデータに対応していますか？",
    answerText:
      "上場企業3,900社以上、10年以上の四半期財務データに対応しています（対応範囲は今後も拡大予定です）。",
    answer: (
      <p>
        上場企業3,900社以上、10年以上の四半期財務データに対応しています（対応範囲は今後も拡大予定です）。
      </p>
    ),
  },
  {
    question: "利用料金はかかりますか？",
    answerText:
      "完全無料でご利用いただけます。エディスクは MIT License のオープンソースソフトウェアとして公開しており、Cloudflare Workers の無料枠で動作するよう設計されています。",
    answer: (
      <p>
        完全無料でご利用いただけます。エディスクは
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          MIT License のオープンソースソフトウェア
        </a>
        として公開しており、Cloudflare Workers の無料枠で動作するよう設計されています。
      </p>
    ),
  },
  {
    question: "データはどのくらいの頻度で更新されますか？",
    answerText:
      "EDINET への新規提出にあわせて取り込みパイプラインを実行し、データを更新しています。運用状況により反映タイミングが前後する場合があるため、最新の正確な情報が必要な場合は必ず EDINET の一次情報をご確認ください。",
    answer: (
      <p>
        EDINET
        への新規提出にあわせて取り込みパイプラインを実行し、データを更新しています。運用状況により反映タイミングが前後する場合があるため、最新の正確な情報が必要な場合は必ず
        EDINET の一次情報をご確認ください。各ページのデータ最終更新日は
        <a href="/privacy" className="text-primary underline-offset-4 hover:underline">
          プライバシーポリシー
        </a>
        内に記載しています。
      </p>
    ),
  },
  {
    question: "どのような指標で企業を検索・比較できますか？",
    answerText:
      "ROE・ROA・ROIC・PER・PBR・自己資本比率・配当利回り・Piotroski F-Scoreなど20種類以上の指標でスクリーニングできます。プリセット条件も用意しており、条件を保存して再利用することも可能です。",
    answer: (
      <p>
        ROE・ROA・ROIC・PER・PBR・自己資本比率・配当利回り・Piotroski
        F-Scoreなど20種類以上の指標でスクリーニングできます。「ROEが高い」「堅実な企業」「成長中」などのプリセット条件も用意しており、条件を保存して再利用することも可能です。
      </p>
    ),
  },
  {
    question: "表示されている数値の正確性は保証されますか？",
    answerText:
      "本サービスは EDINET 開示情報をもとに機械的に加工・集計したものであり、正確性・完全性・最新性を保証するものではありません。投資その他の意思決定は、必ず EDINET に掲載されている一次資料（原文）をご確認のうえ、ご自身の判断と責任で行ってください。",
    answer: (
      <p>
        本サービスは EDINET
        開示情報をもとに機械的に加工・集計したものであり、正確性・完全性・最新性を保証するものではありません。投資その他の意思決定は、必ず
        EDINET に掲載されている一次資料（原文）をご確認のうえ、ご自身の判断と責任で行ってください。
      </p>
    ),
  },
  {
    question: "お気に入り登録や表示設定はどこに保存されますか？",
    answerText:
      "お気に入り銘柄・表示列の設定・最近見た企業などは、サーバーには送信されずお使いのブラウザの localStorage 内にのみ保存されます。別の端末・ブラウザからは引き継がれず、ブラウザの設定から削除することもできます。",
    answer: (
      <p>
        お気に入り銘柄・表示列の設定・最近見た企業などは、サーバーには送信されずお使いのブラウザの
        localStorage
        内にのみ保存されます。別の端末・ブラウザからは引き継がれず、ブラウザの設定から削除することもできます。
      </p>
    ),
  },
  {
    question: "自分でホスティング（フォーク運用）できますか？",
    answerText:
      "はい。エディスクはオープンソースで公開しており、GitHub リポジトリをフォークして Cloudflare Workers に自分でデプロイすることができます。手順はリポジトリの README・docs 以下に記載しています。",
    answer: (
      <p>
        はい。エディスクはオープンソースで公開しており、
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          GitHub リポジトリ
        </a>
        をフォークして Cloudflare Workers に自分でデプロイすることができます。手順はリポジトリの
        README・docs 以下に記載しています。
      </p>
    ),
  },
  {
    question: "不具合の報告や機能の要望はどこに送ればいいですか？",
    answerText: "お問い合わせページから、または GitHub の Issues からご連絡ください。",
    answer: (
      <p>
        <a href="/contact" className="text-primary underline-offset-4 hover:underline">
          お問い合わせページ
        </a>
        から、または GitHub の
        <a
          href={`${GITHUB_REPO}/issues`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Issues
        </a>
        からご連絡ください。
      </p>
    ),
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answerText,
    },
  })),
};

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-auto p-4 lg:p-8">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: 構造化データの埋め込みに必要
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">よくある質問（FAQ）</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          エディスクのデータ・料金・使い方に関するよくある質問をまとめています。解決しない場合は
          <a href="/contact" className="text-primary underline-offset-4 hover:underline">
            お問い合わせ
          </a>
          からご連絡ください。
        </p>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <Card key={item.question}>
            <CardHeader>
              <CardTitle className="text-base leading-relaxed">{item.question}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              {item.answer}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
