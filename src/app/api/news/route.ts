import { NextResponse } from "next/server";
import { getMarketNews } from "@/lib/finnhub";
import { envCheckResponse, getMissingFinnhubEnvVars } from "@/lib/env";

export async function GET() {
  const blocked = envCheckResponse(getMissingFinnhubEnvVars);
  if (blocked) {
    return blocked;
  }

  const news = await getMarketNews();
  return NextResponse.json(news);
}
