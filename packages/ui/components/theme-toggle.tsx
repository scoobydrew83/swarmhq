"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("swarm-theme");
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("swarm-theme", next); } catch (_) {}
  }

  return (
    <button className="icon-btn" onClick={toggle} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      <span className="ms">{theme === "dark" ? "light_mode" : "dark_mode"}</span>
    </button>
  );
}
