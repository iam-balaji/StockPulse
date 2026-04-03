import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { pool, ensureTables } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
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
    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), hashed]
    );
    const user = result.rows[0];
    const token = signToken({ userId: user.id, email: user.email });
    return NextResponse.json({ token, user });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Signup failed." }, { status: 500 });
  }
}
