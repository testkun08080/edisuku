import type { AppType } from "@edinet/api";
import { hc } from "hono/client";

/** Same-origin BFF via query param on /screener (avoids *.workers.dev path/header blocks). */
export const apiBaseUrl = "";

const bffFetch: typeof fetch = (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/api/")) {
    return fetch(request, init);
  }

  const resource = `${url.pathname.slice(4)}${url.search}`.replace(/^\//, "");
  const proxyUrl = `/screener?_q=${encodeURIComponent(resource)}`;

  return fetch(
    new Request(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: request.redirect,
      signal: request.signal,
    }),
  );
};

export const api = hc<AppType>(apiBaseUrl, { fetch: bffFetch });
