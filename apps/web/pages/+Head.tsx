// https://vike.dev/Head

import {
  SITE_APPLE_TOUCH_ICON_PATH,
  SITE_FAVICON_48_PATH,
  SITE_FAVICON_192_PATH,
  SITE_FAVICON_PATH,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_OG_DESCRIPTION,
  SITE_OG_IMAGE_ALT,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_PATH,
  SITE_OG_IMAGE_SQUARE_PATH,
  SITE_OG_IMAGE_SQUARE_SIZE,
  SITE_OG_IMAGE_WIDTH,
  SITE_WEB_MANIFEST_PATH,
} from "../lib/brand";

export function Head() {
  const siteTitle = SITE_NAME;
  const siteDescription = SITE_OG_DESCRIPTION;
  const siteUrl = import.meta.env.PUBLIC_ENV__SITE_URL || "https://edisuku.com";
  const ogImageUrl = siteUrl ? `${siteUrl}${SITE_OG_IMAGE_PATH}` : "";
  const ogImageSquareUrl = siteUrl ? `${siteUrl}${SITE_OG_IMAGE_SQUARE_PATH}` : "";

  return (
    <>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="description" content={siteDescription} />
      <meta name="keywords" content={SITE_KEYWORDS} />
      <meta name="author" content="edisuku" />
      <meta name="robots" content="index, follow" />

      {/* OGP — 正方形を先に指定（1:1 クロップする SNS 向け）、横長は標準カード用 */}
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={siteDescription} />
      <meta property="og:type" content="website" />
      {siteUrl && <meta property="og:url" content={siteUrl} />}
      {ogImageUrl && <meta property="og:image" content={ogImageUrl} />}
      {ogImageUrl && <meta property="og:image:width" content={String(SITE_OG_IMAGE_WIDTH)} />}
      {ogImageUrl && <meta property="og:image:height" content={String(SITE_OG_IMAGE_HEIGHT)} />}
      {ogImageUrl && <meta property="og:image:alt" content={SITE_OG_IMAGE_ALT} />}
      {ogImageSquareUrl && <meta property="og:image" content={ogImageSquareUrl} />}
      {ogImageSquareUrl && (
        <meta property="og:image:width" content={String(SITE_OG_IMAGE_SQUARE_SIZE)} />
      )}
      {ogImageSquareUrl && (
        <meta property="og:image:height" content={String(SITE_OG_IMAGE_SQUARE_SIZE)} />
      )}
      {ogImageSquareUrl && <meta property="og:image:alt" content={SITE_OG_IMAGE_ALT} />}
      <meta property="og:site_name" content={siteTitle} />
      <meta property="og:locale" content="ja_JP" />

      {/* Twitter Card — 横長を優先（summary_large_image） */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={siteDescription} />
      {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
      {ogImageUrl && <meta name="twitter:image:alt" content={SITE_OG_IMAGE_ALT} />}

      {/* Canonical */}
      {siteUrl && <link rel="canonical" href={siteUrl} />}

      {/* Favicon — 安定パス（Google 検索のサイトアイコン向け） */}
      <link rel="icon" href={SITE_FAVICON_PATH} sizes="48x48" />
      <link rel="icon" type="image/png" href={SITE_FAVICON_48_PATH} sizes="48x48" />
      <link rel="icon" type="image/png" href={SITE_FAVICON_192_PATH} sizes="192x192" />
      <link rel="apple-touch-icon" href={SITE_APPLE_TOUCH_ICON_PATH} />
      <link rel="manifest" href={SITE_WEB_MANIFEST_PATH} />

      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@400&display=swap"
        rel="stylesheet"
      />

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: siteTitle,
            description: siteDescription,
            ...(siteUrl ? { url: siteUrl } : {}),
            applicationCategory: "FinanceApplication",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "JPY",
            },
          }),
        }}
      ></script>
    </>
  );
}
