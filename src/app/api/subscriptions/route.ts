import { NextRequest, NextResponse } from "next/server";
import { ensureAppUser, ensureTables, getPool } from "@/lib/db";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { envCheckResponse, getMissingFirebaseAuthEnvVars } from "@/lib/env";

async function getUserIdFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { userId: null as number | null, reason: "missing_token" };
  }
  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    const userId = await ensureAppUser(decoded.uid, decoded.email || null);
    return { userId, reason: null as string | null };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (typeof code === "string" && code.startsWith("auth/")) {
      return { userId: null as number | null, reason: code };
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[api/subscriptions] token verification failed", error);
    }
    throw error;
  }
}

export async function GET(req: NextRequest) {
  const blocked = envCheckResponse(getMissingFirebaseAuthEnvVars);
  if (blocked) {
    return blocked;
  }

  try {
    await ensureTables();
    const auth = await getUserIdFromRequest(req);
    if (!auth.userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          ...(process.env.NODE_ENV === "development" ? { detail: auth.reason } : {})
        },
        { status: 401 }
      );
    }

    const result = await getPool().query(
      `
        SELECT s.symbol, sub.notify_daily
        FROM subscriptions sub
        JOIN stocks s ON s.id = sub.stock_id
        WHERE sub.user_id = $1
        ORDER BY s.symbol ASC
      `,
      [auth.userId]
    );

    return NextResponse.json(result.rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Subscriptions fetch failed.";
    return NextResponse.json(
      {
        error: "Subscriptions fetch failed.",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {})
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const blocked = envCheckResponse(getMissingFirebaseAuthEnvVars);
  if (blocked) {
    return blocked;
  }

  try {
    await ensureTables();
    const auth = await getUserIdFromRequest(req);
    if (!auth.userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          ...(process.env.NODE_ENV === "development" ? { detail: auth.reason } : {})
        },
        { status: 401 }
      );
    }

    const { symbol } = await req.json();
    const normalized = String(symbol || "").toUpperCase().trim();
    if (!normalized) return NextResponse.json({ error: "Symbol is required" }, { status: 400 });

    const stock = await getPool().query(
      "INSERT INTO stocks (symbol) VALUES ($1) ON CONFLICT (symbol) DO UPDATE SET symbol = EXCLUDED.symbol RETURNING id, symbol",
      [normalized]
    );

    await getPool().query(
      "INSERT INTO subscriptions (user_id, stock_id) VALUES ($1, $2) ON CONFLICT (user_id, stock_id) DO NOTHING",
      [auth.userId, stock.rows[0].id]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Subscription update failed.";
    return NextResponse.json(
      {
        error: "Subscription update failed.",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {})
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = envCheckResponse(getMissingFirebaseAuthEnvVars);
  if (blocked) {
    return blocked;
  }

  try {
    await ensureTables();
    const auth = await getUserIdFromRequest(req);
    if (!auth.userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          ...(process.env.NODE_ENV === "development" ? { detail: auth.reason } : {})
        },
        { status: 401 }
      );
    }

    const { symbol } = await req.json();
    const normalized = String(symbol || "").toUpperCase().trim();
    if (!normalized) return NextResponse.json({ error: "Symbol is required" }, { status: 400 });

    await getPool().query(
      `
        DELETE FROM subscriptions
        WHERE user_id = $1
        AND stock_id IN (SELECT id FROM stocks WHERE symbol = $2)
      `,
      [auth.userId, normalized]
    );

       return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Subscription removal failed.";
    return NextResponse.json(
      {
        error: "Subscription removal failed.",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {})
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const blocked = envCheckResponse(getMissingFirebaseAuthEnvVars);
  if (blocked) {
    return blocked;
  }

  try {
    await ensureTables();
    const auth = await getUserIdFromRequest(req);
    if (!auth.userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          ...(process.env.NODE_ENV === "development" ? { detail: auth.reason } : {})
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const normalized = String(body?.symbol || "").toUpperCase().trim();
    if (!normalized) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }
    if (typeof body?.notify_daily !== "boolean") {
      return NextResponse.json({ error: "notify_daily must be a boolean" }, { status: 400 });
    }
    const notifyDaily = body.notify_daily;

    const updated = await getPool().query(
      `
        UPDATE subscriptions sub
        SET notify_daily = $3
        FROM stocks s
        WHERE sub.stock_id = s.id
          AND sub.user_id = $1
          AND s.symbol = $2
        RETURNING sub.id
      `,
      [auth.userId, normalized, notifyDaily]
    );

    if (!updated.rows[0]) {
      return NextResponse.json(
        { error: "Watchlist symbol not found. Add the stock to your watchlist first." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, symbol: normalized, notify_daily: notifyDaily });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Notification preference update failed.";
    return NextResponse.json(
      {
        error: "Notification preference update failed.",
        ...(process.env.NODE_ENV === "development" ? { detail: message } : {})
      },
      { status: 500 }
    );
  }
}
