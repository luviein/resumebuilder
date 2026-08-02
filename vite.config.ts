import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
        start_url: "/",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,json}"],
      },
    }),
  ],
});
