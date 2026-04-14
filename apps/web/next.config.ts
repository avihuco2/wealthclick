import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["israeli-bank-scrapers", "puppeteer", "puppeteer-core"],
};

export default nextConfig;
