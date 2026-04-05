import { NextRequest, NextResponse } from "next/server";
import { getCandles, getQuote, getTopNews } from "@/lib/finnhub";
import { envCheckResponse, getMissingFinnhubEnvVars } from "@/lib/env";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const blocked = envCheckResponse(getMissingFinnhubEnvVars);
  if (blocked) {
    return blocked;
  }

  try {
    const { symbol } = await params;
    const normalized = symbol.toUpperCase();
    const quote = await getQuote(normalized);

    // Keep details endpoint usable even if candles/news intermittently fail.
    const [candlesResult, newsResult] = await Promise.allSettled([
      getCandles(normalized),
      getTopNews(normalized)
    ]);

    const candles = candlesResult.status === "fulfilled" ? candlesResult.value : [];
    const news = newsResult.status === "fulfilled" ? newsResult.value : [];

    return NextResponse.json({ quote, candles, news });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Stock details fetch failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
