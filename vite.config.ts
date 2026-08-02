import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves this as a project site at /resumebuilder/, not the domain root, so every
// asset path needs that prefix. Local dev/build stay at "/" — only the CI deploy sets this env var.
const base = process.env.GITHUB_PAGES === "true" ? "/resumebuilder/" : "/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: {
        name: "Offline Resume Builder",
        short_name: "ResumeBuilder",
        description: "Privacy-first, offline, JSON-driven resume builder with ATS-friendly PDF export.",
        theme_color: "#1a1a1a",
        background_color: "#f4f4f5",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: `${base}icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,json}"],
      },
    }),
  ],
});
