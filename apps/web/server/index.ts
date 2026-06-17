import { apply, serve } from "@photonjs/srvx";
import { getMiddlewares } from "vike-photon/universal-middlewares";
import { apiProxyMiddleware } from "./api-proxy.js";
import { headMiddleware } from "./head.js";
import { sitemapMiddleware } from "./sitemap.js";

function startServer() {
  const app = apply([
    headMiddleware(),
    sitemapMiddleware(),
    apiProxyMiddleware(),
    ...getMiddlewares({ compress: false }),
  ]);
  return serve(app);
}

export default startServer();
