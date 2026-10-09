/** @type {import('next').NextConfig} */
const nextConfig = {
  // Chromium for PDF rendering must not be bundled/traced by webpack.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
};

export default nextConfig;
