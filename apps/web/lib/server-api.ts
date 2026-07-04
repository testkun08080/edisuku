import { env } from "cloudflare:workers";
import type { ManifestResponse } from "@edinet/types";

const API_KEY_HEADER = "X-Internal-Api-Key";

/** Server-side manifest fetch (service binding or local API_UPSTREAM_URL). */
export async function fetchManifest(): Promise<ManifestResponse> {
  const apiKey = env.INTERNAL_API_KEY;
  if (!apiKey) {
    throw new Error("INTERNAL_API_KEY is not set");
  }

  const headers = new Headers({ [API_KEY_HEADER]: apiKey });

  const upstreamBase = env.API_UPSTREAM_URL?.replace(/\/$/, "");
  if (upstreamBase) {
    const res = await fetch(`${upstreamBase}/api/manifest`, { headers });
    if (!res.ok) {
      throw new Error(`manifest fetch failed: ${res.status}`);
    }
    return (await res.json()) as ManifestResponse;
  }

  const apiBinding = env.API;
  if (apiBinding) {
    const res = await apiBinding.fetch(new Request("https://internal/api/manifest", { headers }));
    if (!res.ok) {
      throw new Error(`manifest fetch failed: ${res.status}`);
    }
    return (await res.json()) as ManifestResponse;
  }

  throw new Error("API service binding or API_UPSTREAM_URL required");
}
