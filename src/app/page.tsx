"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6">
      <h1 className="mb-4 text-4xl font-bold">Stock Market Tracker</h1>
      <p className="mb-8 text-center text-slate-600">
        Track subscribed stocks, prices, charts, and related market news.
      </p>
      <div className="flex gap-3">
        <button className="btn-primary" onClick={() => router.push("/signup")}>
          Sign Up
        </button>
        <button className="btn-secondary" onClick={() => router.push("/login")}>
          Login
        </button>
      </div>
    </main>
  );
}
