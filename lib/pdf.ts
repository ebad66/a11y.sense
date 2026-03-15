import { chromium } from 'playwright';

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const data = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
    });
    return Buffer.from(data);
  } finally {
    await page.close();
    await browser.close();
  }
}
