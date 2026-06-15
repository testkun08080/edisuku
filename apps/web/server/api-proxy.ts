import { enhance } from "@universal-middleware/core";
import { env } from "cloudflare:workers";

const PROXY_QUERY = "_q";
const API_KEY_HEADER = "X-Internal-Api-Key";
const PROXY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function resolveUpstreamApiPath(request: Request): string | null {
  const resource = new URL(request.url).searchParams.get(PROXY_QUERY)?.trim();
  if (!resource || resource.includes("/api/")) {
    return null;
  }
  const pathPart = resource.startsWith("/") ? resource : `/${resource}`;
  const [pathname, query] = pathPart.split("?");
  if (!pathname.startsWith("/") || pathname === "/") {
    return null;
  }
  return `/api${pathname}${query ? `?${query}` : ""}`;
}

export function apiProxyMiddleware() {
  return enhance(
    async (request) => {
      const apiPath = resolveUpstreamApiPath(request);
      if (!apiPath || !PROXY_METHODS.has(request.method)) {
        return;
      }

      const apiBinding = env.API;
      const apiKey = env.INTERNAL_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error: "proxy_misconfigured",
            message: "Set INTERNAL_API_KEY in .dev.vars or Worker secrets",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }

      const headers = new Headers(request.headers);
      headers.set(API_KEY_HEADER, apiKey);
      headers.delete("host");

      if (apiBinding) {
        return apiBinding.fetch(
          new Request(`https://internal${apiPath}`, {
            method: request.method,
            headers,
          }),
        );
      }

      // フォールバック: URL 転送（vike dev 環境など service binding 未接続時）
      const upstreamBase = env.API_UPSTREAM_URL?.replace(/\/$/, "");
      if (!upstreamBase) {
        return new Response(
          JSON.stringify({
            error: "proxy_misconfigured",
            message: "API service binding or API_UPSTREAM_URL required",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }

      return fetch(`${upstreamBase}${apiPath}`, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      });
    },
    {
      name: "api-proxy",
      order: -100,
    },
  );
}
