"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

function getClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };
}

export function isFirebaseClientConfigured(): boolean {
  const c = getClientConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

function getFirebaseApp() {
  if (!isFirebaseClientConfigured()) {
    throw new Error("Firebase client is not configured.");
  }
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp(getClientConfig());
}

export const firebaseAuth = (() => {
  try {
    return getAuth(getFirebaseApp());
  } catch {
    return null;
  }
})();
