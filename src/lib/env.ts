/**
 * Server-only env validation for API routes and DB/auth helpers.
 * Do not import in client components.
 */

import { NextResponse } from "next/server";

const PLACEHOLDER_FINNHUB = "your-finnhub-api-key";

export function getMissingDatabaseEnvVars(): string[] {
  if (!process.env.DATABASE_URL?.trim()) {
    return ["DATABASE_URL"];
  }
  return [];
}

export function getMissingAuthEnvVars(): string[] {
  const missing = getMissingDatabaseEnvVars();
  if (!process.env.JWT_SECRET?.trim()) {
    missing.push("JWT_SECRET");
  }
  return missing;
}

export function getMissingFinnhubEnvVars(): string[] {
  const finnhub = process.env.FINNHUB_API_KEY?.trim();
  if (!finnhub || finnhub === PLACEHOLDER_FINNHUB) {
    return ["FINNHUB_API_KEY"];
  }
  return [];
}

/** All three vars required for a fully configured deployment. */
export function getMissingEnvVars(): string[] {
  return [...new Set([...getMissingAuthEnvVars(), ...getMissingFinnhubEnvVars()])];
}

/**
 * Returns a 503 JSON response if any listed env vars are missing, else null.
 * In development, includes which keys are missing.
 */
export function envCheckResponse(getMissing: () => string[]): NextResponse | null {
  const missing = getMissing();
  if (missing.length === 0) {
    return null;
  }
  return NextResponse.json(
    {
      error: "Service unavailable: required environment variables are not set.",
      missing: process.env.NODE_ENV === "development" ? missing : undefined
    },
    { status: 503 }
  );
}
