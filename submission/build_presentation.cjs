const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`file://${path.resolve(__dirname, "PRESENTATION.html")}`);
    await page.pdf({
      path: path.join(__dirname, "PRESENTATION.pdf"),
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
