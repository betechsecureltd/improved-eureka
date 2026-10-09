// Render HTML to a PDF buffer across environments:
//  - Railway / any Linux container: system Chromium (via PUPPETEER_EXECUTABLE_PATH
//    or found on PATH) + puppeteer-core
//  - Vercel / Lambda (serverless): @sparticuz/chromium + puppeteer-core
//  - Local dev: full puppeteer (bundles its own Chromium)
import { execSync } from "node:child_process";

function resolveSystemChromium(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const cmd of ["which chromium", "which chromium-browser", "which google-chrome-stable"]) {
    try {
      const p = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      if (p) return p;
    } catch {
      /* not found, try next */
    }
  }
  return undefined;
}

async function renderWith(executablePath: string, html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  // 1. System Chromium (Railway and most container hosts).
  const systemChromium = resolveSystemChromium();
  if (systemChromium) {
    return renderWith(systemChromium, html);
  }

  // 2. Serverless bundled Chromium (Vercel / Lambda).
  if (process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return renderWith(await chromium.executablePath(), html);
  }

  // 3. Local dev: full puppeteer with its own Chromium.
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
