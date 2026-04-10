import { CandlePoint, StockNews, StockQuote } from "@/types/stock";

const BASE = "https://finnhub.io/api/v1";

function getApiKey() {
  const key = process.env.FINNHUB_API_KEY?.trim();
  if (!key || key === "your-finnhub-api-key") {
    throw new Error("FINNHUB_API_KEY is missing or invalid");
  }
  return key;
}

async function fetchJson(path: string) {
  const apiKey = getApiKey();
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${separator}token=${apiKey}`, {
    next: { revalidate: 30 }
  });
  if (!res.ok) {
    const responseText = await res.text();
    throw new Error(`Finnhub request failed (${res.status}): ${responseText}`);
  }
  return res.json();
}

export async function searchSymbols(query: string) {
  if (!query.trim()) return [];
  let finnhubResults: Array<{ symbol: string; description: string }> = [];

  try {
    const data = await fetchJson(`/search?q=${encodeURIComponent(query)}`);
    finnhubResults = (data.result || [])
      .filter(
        (item: { symbol?: string; description?: string }) => !!item?.symbol && !!item?.description
      )
      .slice(0, 10)
      .map((item: { symbol: string; description: string }) => ({
        symbol: item.symbol,
        description: item.description
      }));
  } catch {
    // Fall back to Yahoo search when Finnhub is unavailable.
  }

  const yahooResults = await searchSymbolsFromYahoo(query);
  const merged = [...finnhubResults, ...yahooResults];
  const deduped = new Map<string, { symbol: string; description: string }>();
  for (const result of merged) {
    if (!deduped.has(result.symbol)) {
      deduped.set(result.symbol, result);
    }
  }
  return Array.from(deduped.values()).slice(0, 15);
}

export async function getQuote(symbol: string): Promise<StockQuote> {
  try {
    const data = await fetchJson(`/quote?symbol=${encodeURIComponent(symbol)}`);
    if (Number(data.c || 0) > 0) {
      return {
        symbol,
        current: Number(data.c || 0),
        open: Number(data.o || 0),
        high: Number(data.h || 0),
        low: Number(data.l || 0)
      };
    }
  } catch {
    // Fall back to Yahoo quote.
  }

  return getQuoteFromYahoo(symbol);
}

export async function getCandles(symbol: string): Promise<CandlePoint[]> {
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 60 * 60 * 24 * 30;
    const data = await fetchJson(
      `/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}`
    );

    if (data?.s === "ok" && Array.isArray(data.t) && Array.isArray(data.c) && data.t.length > 0) {
      return data.t.map((timestamp: number, i: number) => ({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close: Number(data.c[i] || 0)
      }));
    }
  } catch {
    // Fall through to Yahoo fallback.
  }

  return getCandlesFromYahoo(symbol);
}

async function getCandlesFromYahoo(symbol: string): Promise<CandlePoint[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1mo&interval=1d`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return [];

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp || [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close || [];

  if (!timestamps.length || !closes.length) return [];

  return timestamps
    .map((timestamp, i) => {
      const close = closes[i];
      if (close == null) return null;
      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close: Number(close)
      };
    })
    .filter((point): point is CandlePoint => point !== null);
}

export async function getTopNews(symbol: string): Promise<StockNews[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10);
    const data = (await fetchJson(
      `/company-news?symbol=${encodeURIComponent(symbol)}&from=${weekAgo}&to=${today}`
    )) as unknown;
    const rows = Array.isArray(data) ? data : [];

    return rows.slice(0, 3).map((raw) => {
      const item = raw as Record<string, unknown>;
      const videos = item.videos;
      const firstVid =
        Array.isArray(videos) && videos[0] && typeof videos[0] === "object"
          ? (videos[0] as Record<string, unknown>).url
          : undefined;
      return {
        id: Number(item.id ?? 0),
        headline: String(item.headline ?? ""),
        source: String(item.source ?? ""),
        summary: String(item.summary ?? ""),
        url: String(item.url ?? "#"),
        imageUrl: typeof item.image === "string" ? item.image : undefined,
        videoUrl:
          typeof item.video === "string"
            ? item.video
            : typeof firstVid === "string"
              ? firstVid
              : undefined
      };
    });
  } catch {
    return getTopNewsFromYahoo(symbol);
  }
}

export async function getMarketNews(): Promise<StockNews[]> {
  try {
    const data = (await fetchJson("/news?category=general")) as unknown;
    const rows = Array.isArray(data) ? data : [];
    return rows.slice(0, 12).map((raw, index) => {
      const item = raw as Record<string, unknown>;
      const videos = item.videos;
      const firstVid =
        Array.isArray(videos) && videos[0] && typeof videos[0] === "object"
          ? (videos[0] as Record<string, unknown>).url
          : undefined;
      return {
        id: Number(item.id ?? index + 1),
        headline: String(item.headline ?? "Market update"),
        source: String(item.source ?? "Market"),
        summary: String(item.summary ?? ""),
        url: String(item.url ?? "#"),
        imageUrl: typeof item.image === "string" ? item.image : undefined,
        videoUrl:
          typeof item.video === "string"
            ? item.video
            : typeof firstVid === "string"
              ? firstVid
              : undefined
      };
    });
  } catch {
    return getMarketNewsFromYahoo();
  }
}

async function getTopNewsFromYahoo(symbol: string): Promise<StockNews[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=8`,
    { next: { revalidate: 120 } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { news?: unknown };
  const rows = Array.isArray(data.news) ? data.news : [];
  return rows.slice(0, 3).map(mapYahooNewsItem);
}

async function getMarketNewsFromYahoo(): Promise<StockNews[]> {
  const res = await fetch(
    "https://query1.finance.yahoo.com/v1/finance/search?q=stock%20market&quotesCount=0&newsCount=12",
    { next: { revalidate: 180 } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { news?: unknown };
  const rows = Array.isArray(data.news) ? data.news : [];
  return rows.slice(0, 12).map(mapYahooNewsItem);
}

function mapYahooNewsItem(raw: unknown, index: number = 0): StockNews {
  const item = (raw || {}) as Record<string, unknown>;
  const numericId = Number(item.id ?? index + 1);
  const thumb = item.thumbnail as
    | string
    | { resolutions?: Array<{ url?: string }> }
    | undefined;
  const imageUrl =
    typeof thumb === "string"
      ? thumb
      : Array.isArray(thumb?.resolutions)
        ? thumb.resolutions.find((r) => typeof r?.url === "string")?.url
        : undefined;
  const provider =
    Array.isArray(item.providerPublishTime) && item.providerPublishTime[0]
      ? String(item.providerPublishTime[0])
      : "";
  return {
    id: Number.isFinite(numericId) ? numericId : index + 1,
    headline: String(item.title ?? item.headline ?? "Market update"),
    source: String(item.publisher ?? item.source ?? "Yahoo Finance"),
    summary: String(item.summary ?? provider),
    url: String(item.link ?? item.url ?? "#"),
    imageUrl,
    videoUrl: undefined
  };
}

async function searchSymbolsFromYahoo(query: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { quotes?: unknown };
  const quotes = Array.isArray(data.quotes) ? data.quotes : [];

  return quotes
    .filter(
      (raw): raw is Record<string, unknown> =>
        typeof raw === "object" &&
        raw !== null &&
        typeof (raw as Record<string, unknown>).symbol === "string" &&
        typeof (raw as Record<string, unknown>).shortname === "string"
    )
    .map((item) => ({
      symbol: String(item.symbol).toUpperCase(),
      description: `${item.shortname}${item.exchange ? ` (${item.exchange})` : ""}`
    }));
}

async function getQuoteFromYahoo(symbol: string): Promise<StockQuote> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1d`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) {
    throw new Error(`Quote unavailable for ${symbol}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const meta = result?.meta || {};

  const current = Number(meta.regularMarketPrice || meta.previousClose || 0);
  const open = Number(meta.regularMarketOpen || meta.previousClose || current || 0);
  const high = Number(meta.regularMarketDayHigh || current || 0);
  const low = Number(meta.regularMarketDayLow || current || 0);

  if (current <= 0) {
    throw new Error(`Quote unavailable for ${symbol}`);
  }

  return { symbol, current, open, high, low };
}
