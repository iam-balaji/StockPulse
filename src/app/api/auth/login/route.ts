import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureTables } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { envCheckResponse, getMissingAuthEnvVars } from "@/lib/env";

export async function POST(req: NextRequest) {
  const blocked = envCheckResponse(getMissingAuthEnvVars);
  if (blocked) {
    return blocked;
  }

  try {
    await ensureTables();
    const { email, password } = await req.json();

    const result = await getPool().query("SELECT id, email, password FROM users WHERE email = $1", [
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
    }
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
