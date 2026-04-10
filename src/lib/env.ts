/**
 * Server-only env validation for API routes and DB/auth helpers.
 * Do not import in client components.
 */

import { NextResponse } from "next/server";

const PLACEHOLDER_FINNHUB = "your-finnhub-api-key";
const PLACEHOLDER_FIREBASE = [
  "your-firebase-api-key",
  "your-project.firebaseapp.com",
  "your-firebase-project-id",
  "your-firebase-app-id",
  "your-firebase-client-email",
  "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
];

export function getMissingDatabaseEnvVars(): string[] {
  if (!process.env.DATABASE_URL?.trim()) {
    return ["DATABASE_URL"];
  }
  return [];
}

export function getMissingAuthEnvVars(): string[] {
  return getMissingFirebaseAuthEnvVars();
}

export function getMissingFirebaseClientEnvVars(): string[] {
  const missing: string[] = [];
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

  if (!apiKey || PLACEHOLDER_FIREBASE.includes(apiKey)) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!authDomain || PLACEHOLDER_FIREBASE.includes(authDomain)) {
    missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  }
  if (!projectId || PLACEHOLDER_FIREBASE.includes(projectId)) {
    missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  }
  if (!appId || PLACEHOLDER_FIREBASE.includes(appId)) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  return missing;
}

export function getMissingFirebaseAdminEnvVars(): string[] {
  const missing: string[] = [];
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (!projectId || PLACEHOLDER_FIREBASE.includes(projectId)) missing.push("FIREBASE_PROJECT_ID");
  if (!clientEmail || PLACEHOLDER_FIREBASE.includes(clientEmail)) {
    missing.push("FIREBASE_CLIENT_EMAIL");
  }
  if (!privateKey || PLACEHOLDER_FIREBASE.includes(privateKey)) {
    missing.push("FIREBASE_PRIVATE_KEY");
  }
  return missing;
}

export function getMissingFirebaseAuthEnvVars(): string[] {
  return [...new Set([...getMissingDatabaseEnvVars(), ...getMissingFirebaseAdminEnvVars()])];
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
  return [
    ...new Set([
      ...getMissingFirebaseAuthEnvVars(),
      ...getMissingFirebaseClientEnvVars(),
      ...getMissingFinnhubEnvVars()
    ])
  ];
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
