"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StockChart from "@/components/StockChart";
import { StockDetailResponse, StockNews } from "@/types/stock";

type SearchResult = { symbol: string; description: string };
type MarketTab = "india" | "us" | "news";

const FALLBACK_TOP_US: SearchResult[] = [
  { symbol: "AAPL", description: "Apple Inc." },
  { symbol: "MSFT", description: "Microsoft" },
  { symbol: "NVDA", description: "NVIDIA" },
  { symbol: "GOOGL", description: "Alphabet" }
];

const FALLBACK_TOP_IN: SearchResult[] = [
  { symbol: "RELIANCE.NS", description: "Reliance Industries" },
  { symbol: "TCS.NS", description: "Tata Consultancy Services" },
  { symbol: "INFY.NS", description: "Infosys" },
  { symbol: "HDFCBANK.NS", description: "HDFC Bank" }
];

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [activeTab, setActiveTab] = useState<MarketTab>("us");
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [editableEmail, setEditableEmail] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [topSearched, setTopSearched] = useState<SearchResult[]>([]);
  const [topSearchedLoading, setTopSearchedLoading] = useState(false);
  const [popularStocks, setPopularStocks] = useState<SearchResult[]>([]);
  const [popularWindow, setPopularWindow] = useState<"hour" | "day">("day");
  const [popularLoading, setPopularLoading] = useState(false);
  const [searchError, setSearchError] = useState<string>("");
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [stockDetail, setStockDetail] = useState<StockDetailResponse | null>(null);
  const [stockError, setStockError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [marketNews, setMarketNews] = useState<StockNews[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [watchlistQuotes, setWatchlistQuotes] = useState<
    Record<string, { price: number; changePercent: number }>
  >({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedEmail = localStorage.getItem("userEmail") || "";
    if (!savedToken) {
      router.push("/login");
      return;
    }
    setToken(savedToken);
    setEmail(savedEmail);
    setEditableEmail(savedEmail);
    setAvatarUrl(localStorage.getItem("userAvatarUrl"));
  }, [router]);

  useEffect(() => {
    setSelectedSymbol("");
    setStockDetail(null);
    setStockError("");
    setLoading(false);
    setSearchTerm("");
    setSearchResults([]);
    setSearchError("");
  }, [activeTab]);

  const fetchSubscriptions = useCallback(
    async (activeToken: string) => {
      const res = await fetch("/api/subscriptions", {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.status === 401) {
        localStorage.clear();
        router.push("/login");
        return;
      }
      const data = await res.json();
      setSubscriptions(data.map((row: { symbol: string }) => row.symbol));
    },
    [router]
  );

  const fetchTopSearched = useCallback(async () => {
    try {
      setTopSearchedLoading(true);
      const res = await fetch("/api/stocks/trending");
      const data = await res.json();
      if (Array.isArray(data)) setTopSearched(data);
    } catch {
      setTopSearched([]);
    } finally {
      setTopSearchedLoading(false);
    }
  }, []);

  const fetchPopularStocks = useCallback(async (windowType: "hour" | "day") => {
    try {
      setPopularLoading(true);
      const res = await fetch(`/api/stocks/popular?window=${windowType}`);
      const data = await res.json();
      if (Array.isArray(data)) setPopularStocks(data);
    } catch {
      setPopularStocks([]);
    } finally {
      setPopularLoading(false);
    }
  }, []);

  const fetchMarketNews = useCallback(async () => {
    try {
      setNewsLoading(true);
      const res = await fetch("/api/news");
      const data = await res.json();
      if (Array.isArray(data)) setMarketNews(data);
    } catch {
      setMarketNews([]);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchSubscriptions(token);
    void fetchPopularStocks("day");
    void fetchTopSearched();
    void fetchMarketNews();
  }, [token, fetchSubscriptions, fetchPopularStocks, fetchTopSearched, fetchMarketNews]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(searchTerm, false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  async function runSearch(query: string, track: boolean) {
    if (!query.trim()) return;
    setSearchError("");
    setSearchLoading(true);
    const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}${track ? "&track=1" : ""}`);
    const data = await res.json();

    if (!res.ok) {
      setSearchError(data?.error || "Search failed.");
      setSearchLoading(false);
      return;
    }
    if (!Array.isArray(data)) {
      setSearchError("Unexpected response from search API.");
      setSearchLoading(false);
      return;
    }

    setSearchResults(data);
    setSearchLoading(false);
  }

  async function addSubscription(symbol: string) {
    if (!token) return;
    await fetch("/api/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ symbol })
    });
    await fetchSubscriptions(token);
    setSelectedSymbol(symbol);
    await loadStock(symbol);
  }

  async function removeSubscription(symbol: string) {
    if (!token) return;
    await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ symbol })
    });
    await fetchSubscriptions(token);
    if (selectedSymbol === symbol) {
      setSelectedSymbol("");
      setStockDetail(null);
    }
  }

  async function toggleBookmark(symbol: string) {
    if (subscriptions.includes(symbol)) {
      await removeSubscription(symbol);
    } else {
      await addSubscription(symbol);
    }
  }

  async function loadStock(symbol: string) {
    setLoading(true);
    setStockError("");
    try {
      const res = await fetch(`/api/stocks/${symbol}`);
      const data = await res.json();
      if (!res.ok) {
        setStockDetail(null);
        setStockError(data?.error || "Unable to load stock details.");
        return;
      }
      setStockDetail(data);
    } catch {
      setStockDetail(null);
      setStockError("Unable to load stock details.");
    } finally {
      setLoading(false);
    }
  }

  async function selectStock(symbol: string) {
    setSearchTerm(symbol);
    setSelectedSymbol(symbol);
    await loadStock(symbol);
  }

  function saveProfile() {
    const normalized = editableEmail.trim().toLowerCase();
    if (!normalized) return;
    localStorage.setItem("userEmail", normalized);
    setEmail(normalized);
    if (draftAvatarUrl) {
      localStorage.setItem("userAvatarUrl", draftAvatarUrl);
      setAvatarUrl(draftAvatarUrl);
    } else {
      localStorage.removeItem("userAvatarUrl");
      setAvatarUrl(null);
    }
    setShowSettings(false);
  }

  const isSymbolVisible = useCallback((symbol: string) => {
    if (activeTab === "news") return true;
    if (activeTab === "india") return symbol.endsWith(".NS") || symbol.endsWith(".BO");
    return !symbol.endsWith(".NS") && !symbol.endsWith(".BO");
  }, [activeTab]);

  const filteredSearchResults = useMemo(
    () => searchResults.filter((item) => isSymbolVisible(item.symbol)),
    [searchResults, isSymbolVisible]
  );
  const filteredPopularStocks = useMemo(
    () => popularStocks.filter((item) => isSymbolVisible(item.symbol)),
    [popularStocks, isSymbolVisible]
  );
  const filteredSubscriptions = useMemo(
    () => subscriptions.filter((symbol) => isSymbolVisible(symbol)),
    [subscriptions, isSymbolVisible]
  );
  const filteredTopSearched = useMemo(
    () => topSearched.filter((item) => isSymbolVisible(item.symbol)),
    [topSearched, isSymbolVisible]
  );

  const displayTopChips = useMemo(() => {
    if (filteredTopSearched.length > 0) return filteredTopSearched;
    return activeTab === "india" ? FALLBACK_TOP_IN : FALLBACK_TOP_US;
  }, [filteredTopSearched, activeTab]);

  useEffect(() => {
    if (!token || filteredSubscriptions.length === 0) {
      setWatchlistQuotes({});
      return;
    }
    const symbols = filteredSubscriptions.join(",");
    let cancelled = false;
    void fetch(`/api/stocks/quotes?symbols=${encodeURIComponent(symbols)}`)
      .then((res) => res.json())
      .then((data: Array<{ symbol: string; price: number; changePercent: number }>) => {
        if (cancelled || !Array.isArray(data)) return;
        const next: Record<string, { price: number; changePercent: number }> = {};
        for (const row of data) {
          const key = row.symbol.toUpperCase();
          next[key] = { price: row.price, changePercent: row.changePercent };
        }
        setWatchlistQuotes(next);
      })
      .catch(() => {
        if (!cancelled) setWatchlistQuotes({});
      });
    return () => {
      cancelled = true;
    };
  }, [token, filteredSubscriptions]);

  const selectedLabel = useMemo(() => selectedSymbol || "None selected", [selectedSymbol]);
  const isIndianSelected = selectedSymbol.endsWith(".NS") || selectedSymbol.endsWith(".BO");

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-8">
          <button className="flex items-center gap-2 text-lg font-bold">
            <span className="rounded-md bg-indigo-600 px-2 py-1 text-white">SP</span>
            StockPulse
          </button>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-500">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="w-56 bg-transparent text-sm outline-none"
              placeholder={activeTab === "news" ? "Search news..." : "Search stocks (e.g., AAPL, RELIANCE.NS)"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="tabs tabs-boxed bg-slate-100 dark:bg-slate-900">
            <button className={`tab ${activeTab === "india" ? "tab-active" : ""}`} onClick={() => setActiveTab("india")}>
              Indian Stocks
            </button>
            <button className={`tab ${activeTab === "us" ? "tab-active" : ""}`} onClick={() => setActiveTab("us")}>
              US Stocks
            </button>
            <button className={`tab ${activeTab === "news" ? "tab-active" : ""}`} onClick={() => setActiveTab("news")}>
              News
            </button>
          </div>
        </div>
        <div className="flex h-10 items-center gap-2">
          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => {
              localStorage.clear();
              router.push("/login");
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 opacity-80">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
          <div className="dropdown dropdown-end">
            <button tabIndex={0} className="btn btn-circle btn-ghost h-10 min-h-10 w-10 p-0">
              <UserAvatarBubble avatarUrl={avatarUrl} sizeClass="h-9 w-9" />
            </button>
            <ul tabIndex={0} className="menu dropdown-content z-[1] mt-2 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow">
              <li className="menu-title flex items-start gap-2 whitespace-normal break-words">
                <UserAvatarBubble avatarUrl={avatarUrl} sizeClass="h-8 w-8 shrink-0" />
                <span className="min-w-0 pt-0.5">{email}</span>
              </li>
              <li>
                <button
                  onClick={() => {
                    setDraftAvatarUrl(avatarUrl);
                    setShowSettings(true);
                  }}
                >
                  Settings / Update profile
                </button>
              </li>
              <li>
                <button onClick={() => setShowAbout(true)}>About</button>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-6">
        {activeTab === "news" ? (
          <section className="mt-6">
            <h2 className="mb-5 text-4xl font-semibold">News</h2>
            {newsLoading ? (
              <span className="loading loading-dots loading-lg" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {marketNews
                  .filter((n) => !searchTerm.trim() || n.headline.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((item) => (
                    <NewsMediaCard key={item.id} item={item} size="lg" />
                  ))}
              </div>
            )}
          </section>
        ) : (
          <>

      <section className="mb-6 mt-4 grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">{activeTab === "india" ? "Indian Stocks" : "US Stocks"}</h2>

          <div className="mb-4 rounded-lg border border-slate-200/70 p-3 dark:border-slate-700">
            <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Top searched today</p>
            {topSearchedLoading ? (
              <span className="loading loading-dots loading-md" />
            ) : (
              <div className="flex min-h-[2.75rem] flex-wrap content-center items-center gap-2">
                {displayTopChips.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className="badge badge-outline flex min-h-[2.5rem] items-center justify-center px-3 py-2 transition hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    onClick={() => void selectStock(item.symbol)}
                  >
                    {item.symbol}
                  </button>
                ))}
              </div>
            )}
          </div>

          {searchError ? (
            <p className="text-sm text-red-600">{searchError}</p>
          ) : searchLoading ? (
            <span className="loading loading-dots loading-lg" />
          ) : (
            <div className="space-y-2">
              {searchTerm.trim() && filteredSearchResults.length === 0 && !searchLoading ? (
                <p className="text-sm text-slate-500">
                  No {activeTab === "india" ? "Indian" : "US"} stocks found for this query.
                </p>
              ) : null}
              {filteredSearchResults.map((item) => (
                <div
                  key={item.symbol}
                  className="card card-compact cursor-pointer rounded-xl border border-base-300 bg-base-100 p-3 shadow-sm transition hover:shadow-md"
                  onClick={async () => {
                    setSelectedSymbol(item.symbol);
                    await loadStock(item.symbol);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="font-semibold">{item.symbol}</p>
                      </div>
                      <p className="truncate text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleBookmark(item.symbol);
                      }}
                      aria-label="Toggle bookmark"
                    >
                      <BookmarkIcon active={subscriptions.includes(item.symbol)} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Watchlist</h2>
          <div className="space-y-2">
            {filteredSubscriptions.length === 0 ? (
              <p className="text-sm text-slate-500">Add stocks to your watchlist to get started.</p>
            ) : (
              filteredSubscriptions.map((symbol) => {
                const wl = getWatchlistQuote(watchlistQuotes, symbol);
                return (
                <div
                  key={symbol}
                  className="card card-compact cursor-pointer rounded-lg border border-base-300 bg-base-100 p-2.5 transition hover:shadow-md"
                  onClick={async () => {
                    setSelectedSymbol(symbol);
                    await loadStock(symbol);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{symbol}</p>
                      {wl ? (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>{formatWatchlistPrice(symbol, wl.price)}</span>
                          <span
                            className={`ml-2 font-medium ${
                              wl.changePercent >= 0 ? "text-emerald-600" : "text-red-500"
                            }`}
                          >
                            {wl.changePercent >= 0 ? "+" : ""}
                            {wl.changePercent.toFixed(2)}%
                          </span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-400">Loading quote…</p>
                      )}
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleBookmark(symbol);
                      }}
                      aria-label="Toggle watchlist"
                    >
                      <BookmarkIcon active={subscriptions.includes(symbol)} />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="card mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Popular Stocks</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Window:</span>
            <select
              className="input !w-auto py-1"
              value={popularWindow}
              onChange={async (e) => {
                const nextWindow = e.target.value as "hour" | "day";
                setPopularWindow(nextWindow);
                await fetchPopularStocks(nextWindow);
              }}
            >
              <option value="hour">Last hour</option>
              <option value="day">Today</option>
            </select>
          </div>
        </div>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Live most-active stocks by trade volume (US + India), plus app watchlist trends.
        </p>
        {popularLoading ? (
          <span className="loading loading-dots loading-lg" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {filteredPopularStocks.map((item) => (
              <div
                key={item.symbol}
                className="card card-compact min-h-24 cursor-pointer rounded-lg border border-base-300 bg-base-100 p-2 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:border-indigo-400/50 hover:shadow-lg dark:hover:border-indigo-500/40"
                onClick={async () => {
                  setSelectedSymbol(item.symbol);
                  await loadStock(item.symbol);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-medium">{item.symbol}</p>
                    </div>
                    <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleBookmark(item.symbol);
                    }}
                    aria-label="Toggle bookmark"
                  >
                    <BookmarkIcon active={subscriptions.includes(item.symbol)} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Stock Details: {selectedLabel}</h2>
        {!selectedSymbol ? (
          <p className="text-sm text-slate-500">Select a subscribed stock to view details.</p>
        ) : loading ? (
          <span className="loading loading-dots loading-lg" />
        ) : stockError ? (
          <p className="text-sm text-red-600">{stockError}</p>
        ) : stockDetail?.quote ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Current" value={stockDetail.quote.current} isIndian={isIndianSelected} />
              <StatCard label="Open" value={stockDetail.quote.open} isIndian={isIndianSelected} />
              <StatCard label="High" value={stockDetail.quote.high} isIndian={isIndianSelected} />
              <StatCard label="Low" value={stockDetail.quote.low} isIndian={isIndianSelected} />
            </div>

            <div>
              <h3 className="mb-2 font-semibold">30-Day Trend</h3>
              <StockChart candles={stockDetail.candles} />
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Top 3 Related News</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {stockDetail.news.map((item) => (
                  <NewsMediaCard key={item.id} item={item} size="md" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Unable to load stock details.</p>
        )}
      </section>
          </>
        )}
      </div>

      {showSettings ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="card w-full max-w-md border border-base-300 bg-base-100 p-5 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Profile Settings</h3>
            <div className="mb-4 flex items-center gap-3">
              <UserAvatarBubble avatarUrl={draftAvatarUrl} sizeClass="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs text-slate-500">Profile photo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="file:mr-2 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:text-white"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setDraftAvatarUrl(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
                <button type="button" className="btn btn-ghost btn-xs mt-1" onClick={() => setDraftAvatarUrl(null)}>
                  Remove photo
                </button>
              </div>
            </div>
            <label className="mb-2 block text-sm text-slate-500">Email</label>
            <input
              className="input mb-4"
              value={editableEmail}
              onChange={(e) => setEditableEmail(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveProfile}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAbout ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="card w-full max-w-lg border border-base-300 bg-base-100 p-5 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold">About StockPulse</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              StockPulse is a lightweight full-stack stock tracker MVP with live market search, watchlists,
              stock details, charts, and market news across US and Indian markets.
            </p>
            <div className="mt-4 flex justify-end">
              <button className="btn btn-primary" onClick={() => setShowAbout(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function getWatchlistQuote(
  quotes: Record<string, { price: number; changePercent: number }>,
  symbol: string
) {
  const key = symbol.toUpperCase();
  return quotes[key] ?? null;
}

function formatWatchlistPrice(symbol: string, price: number) {
  const isIn = symbol.endsWith(".NS") || symbol.endsWith(".BO");
  return isIn
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }).format(price)
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
      }).format(price);
}

function UserAvatarBubble({ avatarUrl, sizeClass }: { avatarUrl: string | null; sizeClass: string }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={`rounded-full object-cover ${sizeClass}`} />
    );
  }
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 ${sizeClass}`}
    >
      <DefaultUserIcon className="h-[55%] w-[55%]" />
    </div>
  );
}

function DefaultUserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function NewsMediaCard({ item, size }: { item: StockNews; size: "lg" | "md" }) {
  const mediaHeight = size === "lg" ? "h-44" : "h-36";
  const cardMin = size === "lg" ? "min-h-[300px]" : "min-h-[260px]";
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className={`card flex cursor-pointer flex-col border border-base-300 bg-base-100 p-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${cardMin}`}
    >
      <div className={`relative mb-3 w-full shrink-0 overflow-hidden rounded-md bg-slate-200 dark:bg-slate-800 ${mediaHeight}`}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
          </div>
        )}
        {item.videoUrl ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="rounded-full bg-white/95 p-3 text-indigo-600 shadow-lg dark:bg-slate-900/90 dark:text-indigo-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
        ) : null}
      </div>
      <p className={`mb-2 line-clamp-2 font-semibold ${size === "lg" ? "text-lg" : ""}`}>{item.headline}</p>
      <p className="mb-2 text-xs text-slate-500">{item.source}</p>
      <p className="line-clamp-3 flex-1 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
    </a>
  );
}

function StatCard({ label, value, isIndian }: { label: string; value: number; isIndian: boolean }) {
  const formatted = isIndian
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }).format(value)
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
      }).format(value);
  return (
    <div className="rounded-lg border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{formatted}</p>
    </div>
  );
}

function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-5 w-5 ${active ? "text-indigo-600" : "text-slate-500"}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 3H7a2 2 0 0 0-2 2v16l7-4 7 4V5a2 2 0 0 0-2-2z"
      />
    </svg>
  );
}

