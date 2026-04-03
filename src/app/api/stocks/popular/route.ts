import { NextResponse } from "next/server";
import { ensureTables, pool } from "@/lib/db";

type WindowType = "hour" | "day";

type PopularStock = {
  symbol: string;
  description: string;
  volume: number;
};

async function fetchMostActive(region: "US" | "IN"): Promise<PopularStock[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=12&scrIds=most_actives&region=${region}&lang=en-US`,
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
    .filter((item: PopularStock) => item.volume > 0);
}

async function fetchLastHourVolume(symbol: string): Promise<number> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`,
    { next: { revalidate: 120 } }
  );
  if (!res.ok) return 0;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const volumes: number[] = result?.indicators?.quote?.[0]?.volume || [];
  if (!Array.isArray(volumes) || volumes.length === 0) return 0;

  // 12 x 5-minute candles = last 60 minutes.
  const recent = volumes.slice(-12);
  return recent.reduce((sum, value) => sum + Number(value || 0), 0);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const windowParam = searchParams.get("window");
    const windowType: WindowType = windowParam === "hour" ? "hour" : "day";

    await ensureTables();

    const [usMostActive, indiaMostActive, topSubscribed] = await Promise.all([
      fetchMostActive("US"),
      fetchMostActive("IN"),
      pool.query(
        `
        SELECT s.symbol, COUNT(*)::int AS subscribers
        FROM subscriptions sub
        JOIN stocks s ON s.id = sub.stock_id
        GROUP BY s.symbol
        ORDER BY subscribers DESC, s.symbol ASC
        LIMIT 10
        `
      )
    ]);

    let marketList: PopularStock[] = [...usMostActive, ...indiaMostActive];

    if (windowType === "hour") {
      const withHourVolume = await Promise.all(
        marketList.slice(0, 16).map(async (item) => ({
          ...item,
          volume: await fetchLastHourVolume(item.symbol)
        }))
      );
      marketList = withHourVolume.filter((item) => item.volume > 0);
    }

    const appList: PopularStock[] = topSubscribed.rows.map(
      (row: { symbol: string; subscribers: number }) => ({
        symbol: row.symbol,
        description: `Popular on this app (${row.subscribers} subscribers)`,
        volume: 0
      })
    );

    const deduped = new Map<string, PopularStock>();
    for (const item of [...marketList, ...appList]) {
      if (!deduped.has(item.symbol)) deduped.set(item.symbol, item);
    }

    const result = Array.from(deduped.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20)
      .map((item) => ({
        symbol: item.symbol,
        description:
          item.volume > 0
            ? `${item.description} • Vol: ${item.volume.toLocaleString()}`
            : item.description
      }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
