import { ExternalLink } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  CONTACT_FORM_EMBED_URL as DEFAULT_CONTACT_FORM_EMBED_URL,
  CONTACT_FORM_URL as DEFAULT_CONTACT_FORM_URL,
  SITE_NAME,
} from "../../lib/brand";

const contactFormEmbedUrl =
  (typeof import.meta.env.PUBLIC_ENV__CONTACT_FORM_URL === "string" &&
    import.meta.env.PUBLIC_ENV__CONTACT_FORM_URL) ||
  DEFAULT_CONTACT_FORM_EMBED_URL;

const contactFormUrl = contactFormEmbedUrl.includes("embedded=true")
  ? contactFormEmbedUrl.replace("?embedded=true", "")
  : DEFAULT_CONTACT_FORM_URL;

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-auto p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">お問い合わせ</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {SITE_NAME}
          に関するご質問・不具合報告・データ表示に関するご指摘などは、下記フォームからご連絡ください。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-lg">お問い合わせフォーム</CardTitle>
            <CardDescription>
              メールアドレス・お名前・お問い合わせ内容をご記入のうえ送信してください。
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <a href={contactFormUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              別タブで開く
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <iframe
            src={contactFormEmbedUrl}
            title="お問い合わせフォーム"
            className="min-h-[720px] w-full rounded-md border bg-background"
            loading="lazy"
          >
            フォームを読み込んでいます…
          </iframe>
        </CardContent>
      </Card>
    </div>
  );
}
