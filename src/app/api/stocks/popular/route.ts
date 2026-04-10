import { NextResponse } from "next/server";
import { ensureTables, getPool } from "@/lib/db";
import { envCheckResponse, getMissingDatabaseEnvVars } from "@/lib/env";

type WindowType = "hour" | "day";
type RegionFilter = "us" | "in" | "all";

type PopularStock = {
  symbol: string;
  description: string;
  volume: number;
};

function isIndianListedSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s.endsWith(".NS") || s.endsWith(".BO");
}

/** Yahoo India screeners sometimes omit .NS / .BO; chart + our UI expect them. */
function normalizeIndianScreenerSymbol(item: Record<string, unknown>): string {
  const sym = String(item.symbol || "").toUpperCase().trim();
  if (!sym) return sym;
  if (isIndianListedSymbol(sym)) return sym;
  const base = sym.split(".")[0];
  const ex = String(item.exchange || "").toUpperCase();
  const fullEx = String(item.fullExchangeName || "").toUpperCase();
  if (
    ex === "NSI" ||
    ex === "NSE" ||
    fullEx.includes("NSE") ||
    fullEx.includes("NATIONAL STOCK EXCHANGE")
  ) {
    return `${base}.NS`;
  }
  if (ex === "BSE" || fullEx.includes("BSE") || fullEx.includes("BOMBAY")) {
    return `${base}.BO`;
  }
  return `${base}.NS`;
}

/** Prefer live session volume; when market is closed / zero, use last meaningful liquidity proxies from Yahoo. */
function screenerVolumeForSort(item: Record<string, unknown>): number {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const n = Number(item[k]);
      if (!Number.isNaN(n) && n > 0) return Math.floor(n);
    }
    return 0;
  };
  return pick(
    "regularMarketVolume",
    "regularMarketVolume30d",
    "averageDailyVolume3Month",
    "averageDailyVolume10Day",
    "averageDailyVolume",
    "fiftyDayAverageDailyVolume"
  );
}

async function fetchMostActive(region: "US" | "IN"): Promise<PopularStock[]> {
  const count = region === "IN" ? 24 : 12;
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=${count}&scrIds=most_actives&region=${region}&lang=en-US`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];

  const data = await res.json();
  const quotes = data?.finance?.result?.[0]?.quotes;
  if (!Array.isArray(quotes)) return [];

  const mapped = quotes
    .filter(
      (raw): raw is Record<string, unknown> =>
        typeof raw === "object" && raw !== null && "symbol" in raw && Boolean((raw as { symbol?: unknown }).symbol)
    )
    .map((item) => {
      const sym =
        region === "IN" ? normalizeIndianScreenerSymbol(item) : String(item.symbol).toUpperCase();
      return {
        symbol: sym,
        description: `${item.shortName ?? item.longName ?? item.symbol}${item.exchange ? ` (${item.exchange})` : ""}`,
        volume: screenerVolumeForSort(item)
      };
    })
    .filter((item: PopularStock) => Boolean(item.symbol));

  if (region === "IN") {
    return mapped.filter((item) => isIndianListedSymbol(item.symbol));
  }

  return mapped.filter((item: PopularStock) => item.volume > 0);
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
  const blocked = envCheckResponse(getMissingDatabaseEnvVars);
  if (blocked) {
    return blocked;
  }

  try {
    const { searchParams } = new URL(req.url);
    const windowParam = searchParams.get("window");
    const windowType: WindowType = windowParam === "hour" ? "hour" : "day";
    const regionRaw = (searchParams.get("region") || "all").toLowerCase();
    const region: RegionFilter =
      regionRaw === "in" || regionRaw === "india" ? "in" : regionRaw === "us" ? "us" : "all";

    await ensureTables();

    const needUs = region === "all" || region === "us";
    const needIn = region === "all" || region === "in";

    const [usMostActive, indiaMostActive, topSubscribed] = await Promise.all([
      needUs ? fetchMostActive("US") : Promise.resolve([] as PopularStock[]),
      needIn ? fetchMostActive("IN") : Promise.resolve([] as PopularStock[]),
      getPool().query(
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

    let marketList: PopularStock[];
    if (region === "us") {
      marketList = [...usMostActive];
    } else if (region === "in") {
      marketList = [...indiaMostActive];
    } else {
      const usSorted = [...usMostActive].sort((a, b) => b.volume - a.volume).slice(0, 12);
      const inSorted = [...indiaMostActive].sort((a, b) => b.volume - a.volume).slice(0, 12);
      marketList = [...usSorted, ...inSorted];
    }

    if (windowType === "hour") {
      const snapshot = marketList.map((item) => ({ ...item }));
      const withHourVolume = await Promise.all(
        marketList.slice(0, 24).map(async (item) => ({
          ...item,
          volume: await fetchLastHourVolume(item.symbol)
        }))
      );
      const hourNonZero = withHourVolume.filter((item) => item.volume > 0);
      // When markets are closed or intraday volume is missing, keep prior (day / screener) volumes.
      marketList = hourNonZero.length > 0 ? hourNonZero : snapshot;
    }

    const appRows = topSubscribed.rows as { symbol: string; subscribers: number }[];
    const appList: PopularStock[] = appRows
      .filter((row) => {
        if (region === "us") return !isIndianListedSymbol(row.symbol);
        if (region === "in") return isIndianListedSymbol(row.symbol);
        return true;
      })
      .map((row) => ({
        symbol: row.symbol,
        description: `Popular on this app (${row.subscribers} subscribers)`,
        volume: 0
      }));

    const deduped = new Map<string, PopularStock>();
    for (const item of [...marketList, ...appList]) {
      if (!deduped.has(item.symbol)) deduped.set(item.symbol, item);
    }

    const merged = Array.from(deduped.values()).filter((item) => {
      if (region === "in") return isIndianListedSymbol(item.symbol);
      if (region === "us") return !isIndianListedSymbol(item.symbol);
      return true;
    });

    const result = merged
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
