"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved: Theme = stored || (systemDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", resolved === "dark");
    setTheme(resolved);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="fixed right-5 top-5 z-50 flex h-10 w-20 items-center rounded-full border border-slate-300 bg-slate-200 p-1 shadow-md transition dark:border-slate-600 dark:bg-slate-700"
      aria-label="Toggle dark mode"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm shadow transition-transform dark:bg-slate-900 ${
          theme === "dark" ? "translate-x-10" : "translate-x-0"
        }`}
      >
        {theme === "dark" ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
