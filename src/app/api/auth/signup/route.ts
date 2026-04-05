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

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Valid email and password (min 6 chars) are required." },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await getPool().query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), hashed]
    );
    const user = result.rows[0];
    const token = signToken({ userId: user.id, email: user.email });
    return NextResponse.json({ token, user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
    }
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
      return NextResponse.json({ error: "Email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Signup failed." }, { status: 500 });
  }
}
