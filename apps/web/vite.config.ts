import { fileURLToPath } from "url";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    vike(),
    react(),
    sentryVitePlugin({
      sourcemaps: {
        disable: false,
      },
    }),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },

  build: {
    sourcemap: true,
  },
});
