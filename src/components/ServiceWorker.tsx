"use client";

import { useEffect } from "react";

/** Regista o service worker (PWA) apenas em produção, para não interferir com o hot reload. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
