import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { pool, ensureTables } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const { email, password } = await req.json();

    const result = await pool.query("SELECT id, email, password FROM users WHERE email = $1", [
      String(email || "").toLowerCase()
    ]);

    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = signToken({ userId: user.id, email: user.email });
    return NextResponse.json({ token, user: { id: user.id, email: user.email } });
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
