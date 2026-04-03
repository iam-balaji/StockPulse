export type CandlePoint = {
  date: string;
  close: number;
};

export type StockQuote = {
  symbol: string;
  current: number;
  open: number;
  high: number;
  low: number;
};

export type StockNews = {
  id: number;
  headline: string;
  source: string;
  summary: string;
  url: string;
  imageUrl?: string;
  videoUrl?: string;
};

export type StockDetailResponse = {
  quote: StockQuote;
  candles: CandlePoint[];
  news: StockNews[];
};
