import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/finnhub";
import { ensureTables, getPool } from "@/lib/db";
import { envCheckResponse, getMissingDatabaseEnvVars } from "@/lib/env";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const track = req.nextUrl.searchParams.get("track") === "1";
    if (!q.trim()) {
      return NextResponse.json([]);
    }

    if (track) {
      const blocked = envCheckResponse(getMissingDatabaseEnvVars);
      if (blocked) {
        return blocked;
      }
    }

    const results = await searchSymbols(q);

    if (track && results.length > 0) {
      await ensureTables();
      const symbols = results.slice(0, 4).map((item: { symbol: string }) => item.symbol.toUpperCase());
      await getPool().query(
        "INSERT INTO search_events (symbol) SELECT UNNEST($1::text[])",
        [symbols]
      );
    }

    return NextResponse.json(results);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
