/** @type {import('next').NextConfig} */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer && nextRuntime === "edge") {
      const { IgnorePlugin } = require("next/dist/compiled/webpack/webpack-lib.js");
      // Ignora imports do Node apenas quando originados do pacote pptxgenjs, 
      // preservando os módulos Node essenciais (crypto, buffer, etc.) no runtime do Next/Cloudflare
      config.plugins.push(new IgnorePlugin({ 
        resourceRegExp: /^node:/,
        contextRegExp: /pptxgenjs/
      }));
    }
    return config;
  },
};

export default nextConfig;
