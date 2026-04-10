"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";
import { firebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase-client";

type Props = {
  mode: "login" | "signup";
};

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function finishLogin() {
    if (!firebaseAuth?.currentUser) {
      throw new Error("No authenticated Firebase user found.");
    }
    const token = await firebaseAuth.currentUser.getIdToken();
    const userEmail = firebaseAuth.currentUser.email || "";
    localStorage.setItem("token", token);
    localStorage.setItem("userEmail", userEmail);
    router.push("/dashboard");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!isFirebaseClientConfigured() || !firebaseAuth) {
        throw new Error("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
      }
      if (mode === "signup") {
        await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      }
      await finishLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleProviderLogin(provider: "google" | "github" | "microsoft") {
    setError("");
    setLoading(true);
    try {
      if (!isFirebaseClientConfigured() || !firebaseAuth) {
        throw new Error("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
      }
      const authProvider =
        provider === "google"
          ? new GoogleAuthProvider()
          : provider === "github"
            ? new GithubAuthProvider()
            : new OAuthProvider("microsoft.com");
      await signInWithPopup(firebaseAuth, authProvider);
      await finishLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1920&q=80')"
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-indigo-950/65 to-cyan-950/70" />
      <div className="card relative z-10 w-full max-w-md border border-white/25 bg-white/90 backdrop-blur-md dark:bg-slate-900/85">
        <h1 className="mb-5 text-2xl font-semibold">{mode === "login" ? "Login" : "Sign Up"}</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              className="input"
              value={email}
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              className="input"
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="btn-primary w-full" disabled={loading} type="submit">
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
          <div className="divider">or continue with</div>
          <div className="grid gap-2">
            <button type="button" className="btn btn-outline w-full" disabled={loading} onClick={() => void handleProviderLogin("google")}>
              Continue with Google
            </button>
            <button type="button" className="btn btn-outline w-full" disabled={loading} onClick={() => void handleProviderLogin("github")}>
              Continue with GitHub
            </button>
            <button type="button" className="btn btn-outline w-full" disabled={loading} onClick={() => void handleProviderLogin("microsoft")}>
              Continue with Microsoft
            </button>
          </div>
          <p className="text-center text-sm text-slate-600">
            {mode === "login" ? "Need an account? " : "Already have an account? "}
            <Link
              href={mode === "login" ? "/signup" : "/login"}
              className="font-medium text-indigo-700 hover:underline"
            >
              {mode === "login" ? "Sign Up" : "Login"}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
