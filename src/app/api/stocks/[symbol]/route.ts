import { NextRequest, NextResponse } from "next/server";
import { getCandles, getQuote, getTopNews } from "@/lib/finnhub";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Stock details fetch failed." },
      { status: 500 }
    );
  }
}
