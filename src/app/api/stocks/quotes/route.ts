import { NextRequest, NextResponse } from "next/server";

type QuoteRow = {
  symbol: string;
  price: number;
  changePercent: number;
};

const YAHOO_TIMEOUT_MS = 5000;

async function fetchYahooQuote(symbol: string): Promise<QuoteRow> {
  const upper = symbol.toUpperCase();
  let res: Response;
  try {
    res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(YAHOO_TIMEOUT_MS)
      }
    );
  } catch {
    return { symbol: upper, price: 0, changePercent: 0 };
  }
  if (!res.ok) {
    return { symbol: upper, price: 0, changePercent: 0 };
  }
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) {
    return { symbol: upper, price: 0, changePercent: 0 };
  }
  const price = Number(meta.regularMarketPrice ?? meta.previousClose ?? 0);
  let changePercent = Number(meta.regularMarketChangePercent);
  if (Number.isNaN(changePercent)) {
    const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? 0);
    if (prev > 0 && price > 0) {
      changePercent = ((price - prev) / prev) * 100;
    } else {
      changePercent = 0;
    }
  }
  return {
    symbol: upper,
    price,
    changePercent
  };
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") || "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 24);

  if (symbols.length === 0) {
    return NextResponse.json([]);
  }

  const rows = await Promise.all(symbols.map((s) => fetchYahooQuote(s)));
  return NextResponse.json(rows);
}
