import { NextRequest, NextResponse } from "next/server";
import { ensureTables, getPool } from "@/lib/db";

function easternDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

type Row = { user_id: number; email: string | null; symbol: string; sub_id: number };

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "StockPulse <onboarding@resend.dev>";
  if (!resendKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 503 }
    );
  }

  try {
    await ensureTables();
    const todayEt = easternDateString(new Date());
    const pool = getPool();

    const { rows } = await pool.query<Row>(
      `
        SELECT sub.id AS sub_id, sub.user_id, u.email, s.symbol
        FROM subscriptions sub
        JOIN users u ON u.id = sub.user_id
        JOIN stocks s ON s.id = sub.stock_id
        WHERE sub.notify_daily = true
          AND (sub.last_digest_et_date IS NULL OR sub.last_digest_et_date < $1::date)
          AND u.email IS NOT NULL
          AND LOWER(TRIM(u.email)) NOT LIKE '%@firebase.local'
        ORDER BY sub.user_id, s.symbol
      `,
      [todayEt]
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No pending digests." });
    }

    const byUser = new Map<number, { email: string; symbols: string[]; subIds: number[] }>();
    for (const r of rows) {
      const email = (r.email || "").trim().toLowerCase();
      const cur = byUser.get(r.user_id);
      if (!cur) {
        byUser.set(r.user_id, { email, symbols: [r.symbol], subIds: [r.sub_id] });
      } else {
        cur.symbols.push(r.symbol);
        cur.subIds.push(r.sub_id);
      }
    }

    let sent = 0;
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const dashboardUrl = baseUrl ? `${baseUrl}/dashboard` : null;

    for (const [, { email, symbols, subIds }] of byUser) {
      const uniqueSymbols = [...new Set(symbols)].sort();
      const listHtml = uniqueSymbols.map((s) => `<li><strong>${s}</strong></li>`).join("");
      const html = `
        <p>Good morning — here is your StockPulse watchlist for <strong>${todayEt}</strong> (US Eastern).</p>
        <p>Symbols:</p>
        <ul>${listHtml}</ul>
        <p>${dashboardUrl ? `<a href="${dashboardUrl}">Open StockPulse</a>` : "<strong>Open StockPulse</strong> (set NEXT_PUBLIC_APP_URL for a clickable link)"}</p>
        <p style="font-size:12px;color:#64748b">You receive this because daily email is enabled for these tickers in your watchlist. Turn it off from the bell icon next to each symbol.</p>
      `.trim();

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: `StockPulse daily watchlist — ${todayEt}`,
          html
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[cron/daily-watchlist-digest] Resend error", res.status, errText);
        continue;
      }

      sent += 1;
      const uniqueSubIds = [...new Set(subIds)];
      await pool.query(
        `
          UPDATE subscriptions
          SET last_digest_et_date = $1::date
          WHERE id = ANY($2::int[])
        `,
        [todayEt, uniqueSubIds]
      );
    }

    return NextResponse.json({
      ok: true,
      sent,
      pendingRows: rows.length,
      users: byUser.size
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cron failed.";
    console.error("[cron/daily-watchlist-digest]", error);
    return NextResponse.json(
      { error: "Digest run failed.", ...(process.env.NODE_ENV === "development" ? { detail: message } : {}) },
      { status: 500 }
    );
  }
}
