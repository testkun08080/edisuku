import { enhance } from "@universal-middleware/core";

function isLikelyPagePath(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/screener")) {
    return true;
  }
  if (pathname === "/contact" || pathname === "/privacy") {
    return true;
  }
  return !pathname.includes(".");
}

export function headMiddleware() {
  return enhance(
    async (request) => {
      if (request.method !== "HEAD") {
        return;
      }

      const { pathname } = new URL(request.url);
      if (!isLikelyPagePath(pathname)) {
        return;
      }

      // Some crawlers probe with HEAD before GET. Return a stable 200 for page routes.
      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    },
    {
      name: "head-fallback",
      order: -300,
    },
  );
}
