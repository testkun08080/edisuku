import { env } from "cloudflare:workers";
import { enhance } from "@universal-middleware/core";

const STATIC_PATHS = ["/", "/screener", "/contact", "/privacy"] as const;

function resolveSiteUrl(request: Request): string {
  const configured = env.PUBLIC_ENV__SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return new URL(request.url).origin;
}

function buildSitemapXml(siteUrl: string): string {
  const urls = STATIC_PATHS.map((path) => {
    const loc = path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`;
    return `  <url><loc>${loc}</loc></url>`;
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("\n");
}

function buildRobotsTxt(siteUrl: string): string {
  return ["User-agent: *", "Allow: /", `Sitemap: ${siteUrl}/sitemap.xml`].join("\n");
}

export function sitemapMiddleware() {
  return enhance(
    async (request) => {
      const { pathname } = new URL(request.url);
      const siteUrl = resolveSiteUrl(request);

      if (pathname === "/sitemap.xml") {
        return new Response(buildSitemapXml(siteUrl), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      if (pathname === "/robots.txt") {
        return new Response(buildRobotsTxt(siteUrl), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    },
    {
      name: "sitemap",
      order: -200,
    },
  );
}
