// Capture the public marketing landing at store screenshot dimensions.
// Usage: node mobile/scripts/shoot-landing.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URL = process.env.SHOOT_URL || "https://tabulamedica.world/";
const OUT = path.resolve(__dirname, "..", "assets", "screenshots");

// Store-required logical viewports (× deviceScaleFactor = required pixel size).
const DEVICES = [
  { id: "iphone-6.7", w: 430, h: 932, dsf: 3 },   // 1290×2796 (App Store 6.7")
  { id: "ipad-12.9", w: 1024, h: 1366, dsf: 2 },  // 2048×2732 (App Store iPad)
  { id: "android-phone", w: 412, h: 915, dsf: 2.625 }, // ~1080×2400 (Play)
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  for (const d of DEVICES) {
    const ctx = await browser.newContext({
      viewport: { width: d.w, height: d.h },
      deviceScaleFactor: d.dsf,
      isMobile: d.id !== "ipad-12.9",
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // Dismiss the onboarding tour modal so screenshots show the real landing page.
    for (const label of ["Skip", "Close", "Got it", "Get Started"]) {
      const btn = page.getByRole("button", { name: label }).first();
      if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); break; }
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1200);
    const full = await page.evaluate(() => document.body.scrollHeight);
    // Capture a few screens down the page for marketing variety.
    const shots = Math.min(3, Math.max(1, Math.floor(full / d.h)));
    for (let i = 0; i < shots; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * d.h);
      await page.waitForTimeout(800);
      const file = path.join(OUT, `${d.id}-${i + 1}.png`);
      await page.screenshot({ path: file });
      const px = `${Math.round(d.w * d.dsf)}x${Math.round(d.h * d.dsf)}`;
      results.push(`${d.id}-${i + 1}.png (${px})`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log("WROTE:\n  " + results.join("\n  "));
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
