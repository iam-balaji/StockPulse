import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth";
import { ensureTables, getPool } from "@/lib/db";
import { envCheckResponse, getMissingAuthEnvVars } from "@/lib/env";

function getUserIdFromRequest(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return payload.userId;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const blocked = envCheckResponse(getMissingAuthEnvVars);
  if (blocked) {
    return blocked;
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTables();
  const result = await getPool().query(
    `
      SELECT s.symbol
      FROM subscriptions sub
      JOIN stocks s ON s.id = sub.stock_id
      WHERE sub.user_id = $1
      ORDER BY s.symbol ASC
    `,
    [userId]
  );

  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const blocked = envCheckResponse(getMissingAuthEnvVars);
  if (blocked) {
    return blocked;
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTables();
  const { symbol } = await req.json();
  const normalized = String(symbol || "").toUpperCase().trim();
  if (!normalized) return NextResponse.json({ error: "Symbol is required" }, { status: 400 });

  const stock = await getPool().query(
    "INSERT INTO stocks (symbol) VALUES ($1) ON CONFLICT (symbol) DO UPDATE SET symbol = EXCLUDED.symbol RETURNING id, symbol",
    [normalized]
  );

  await getPool().query(
    "INSERT INTO subscriptions (user_id, stock_id) VALUES ($1, $2) ON CONFLICT (user_id, stock_id) DO NOTHING",
    [userId, stock.rows[0].id]
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const blocked = envCheckResponse(getMissingAuthEnvVars);
  if (blocked) {
    return blocked;
  }

  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTables();
  const { symbol } = await req.json();
  const normalized = String(symbol || "").toUpperCase().trim();
  if (!normalized) return NextResponse.json({ error: "Symbol is required" }, { status: 400 });

  await getPool().query(
    `
      DELETE FROM subscriptions
      WHERE user_id = $1
      AND stock_id IN (SELECT id FROM stocks WHERE symbol = $2)
    `,
    [userId, normalized]
  );

  return NextResponse.json({ success: true });
}
