
import { chromium } from "playwright";
import { generateReportHTML } from "./report";

export async function generatePDF(data:any){
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(generateReportHTML(data));
  const pdf = await page.pdf({ format:"A4" });
  await browser.close();
  return pdf;
}
