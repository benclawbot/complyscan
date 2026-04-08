
import { NextResponse } from "next/server";
import { generatePDF } from "@/lib/report-pdf";

export async function GET(){
  const pdf = await generatePDF({url:"example.com",score:58,risk:"High"});
  return new NextResponse(pdf, {
    headers:{
      "Content-Type":"application/pdf"
    }
  });
}
