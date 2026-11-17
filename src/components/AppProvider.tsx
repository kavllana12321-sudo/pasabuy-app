"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/types";
type AppContextValue = { data: Snapshot | null; loading: boolean; error: string; refresh: () => Promise<void>; mutate: (action: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown>> };
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestNumber = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++requestNumber.current;
    try {
      const response = await fetch("/api/app", { cache: "no-store" });
      const body = await response.json();
      if (request !== requestNumber.current) return;
      if (response.status === 401) { setData(null); setError(""); return; }
      if (!response.ok) throw new Error(body.error || "Could not load your workspace.");
      setData(body); setError("");
    } catch (err) { if (request === requestNumber.current) setError(err instanceof Error ? err.message : "Connection failed. Please try again."); }
    finally { if (request === requestNumber.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  const mutate = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const response = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, action }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not save. Please try again.");
    await refresh(); return body as Record<string, unknown>;
  }, [refresh]);
  return <AppContext.Provider value={{ data, loading, error, refresh, mutate }}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error("useApp must be inside AppProvider"); return context; }
