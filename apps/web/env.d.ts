declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    INTERNAL_API_KEY: string;
    API_UPSTREAM_URL?: string;
    PUBLIC_ENV__SITE_URL?: string;
    API?: { fetch(req: Request): Promise<Response> };
  }
}
