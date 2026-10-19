import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 演示入口不加载模板的后端代理、动态菜单和站点配置。
export default defineConfig({
  base: "./",
  plugins: [vue()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: { outDir: "dist", target: "es2022" },
});
