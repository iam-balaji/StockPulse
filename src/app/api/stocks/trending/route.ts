import { NextResponse } from "next/server";

type TopVolumeStock = {
  symbol: string;
  description: string;
  volume: number;
};

async function fetchMostActive(region: "US" | "IN") {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=8&scrIds=most_actives&region=${region}&lang=en-US`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const quotes = data?.finance?.result?.[0]?.quotes;
  if (!Array.isArray(quotes)) return [];

  return quotes
    .filter((item: any) => item?.symbol)
    .map((item: any) => ({
      symbol: String(item.symbol).toUpperCase(),
      description: `${item.shortName || item.longName || item.symbol}${item.exchange ? ` (${item.exchange})` : ""}`,
      volume: Number(item.regularMarketVolume || 0)
    }))
    .filter((item: TopVolumeStock) => item.volume > 0);
}

export async function GET() {
  try {
    const [us, india] = await Promise.all([fetchMostActive("US"), fetchMostActive("IN")]);
    const deduped = new Map<string, TopVolumeStock>();
    for (const item of [...us, ...india]) {
      if (!deduped.has(item.symbol)) deduped.set(item.symbol, item);
    }

    const result = Array.from(deduped.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 4)
      .map((item) => ({
        symbol: item.symbol,
        description: `Vol: ${item.volume.toLocaleString()}`
      }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
