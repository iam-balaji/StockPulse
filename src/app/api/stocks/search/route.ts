import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/finnhub";
import { ensureTables, pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const track = req.nextUrl.searchParams.get("track") === "1";
    if (!q.trim()) {
      return NextResponse.json([]);
    }
    const results = await searchSymbols(q);

    if (track && results.length > 0) {
      await ensureTables();
      const symbols = results.slice(0, 4).map((item: { symbol: string }) => item.symbol.toUpperCase());
      await pool.query(
        "INSERT INTO search_events (symbol) SELECT UNNEST($1::text[])",
        [symbols]
      );
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Search failed." },
      { status: 500 }
    );
  }
}
