"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { homeFor } from "@/lib/types";
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data, loading, error, refresh } = useApp();
  const pathname = usePathname(); const router = useRouter();
  const [signingOut, setSigningOut] = useState(false); const [logoutError, setLogoutError] = useState("");
  const shared = ["/customer/marketplace", "/customer/messages", "/customer/profile", "/customer/notifications", "/customer/tracking", "/customer/bookings"].includes(pathname);
  const wrongRole = data && !shared && (pathname.startsWith("/admin") ? data.user.role !== "admin" : pathname.startsWith("/rider") ? data.user.role !== "rider" : data.user.role !== "customer");
  useEffect(() => { if (!loading && !data && !error) router.replace("/login"); if (wrongRole && data) router.replace(homeFor(data.user.role)); }, [loading, data, error, router, wrongRole]);
  async function logout() {
    setSigningOut(true); setLogoutError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
      if (!response.ok) throw new Error("Sign out failed. Try again.");
      await refresh(); router.replace("/login");
    } catch (err) { setLogoutError(err instanceof Error ? err.message : "Sign out failed."); }
    finally { setSigningOut(false); }
  }
  if (loading || (!data && !error) || wrongRole) return <main className="grid min-h-screen place-items-center"><p className="muted" role="status">Opening your workspace…</p></main>;
  if (!data) return <main className="mx-auto max-w-lg p-8"><div className="card"><h1 className="text-xl font-bold">Unable to connect</h1><p className="error my-4">{error}</p><button className="btn" onClick={() => void refresh()}>Try again</button></div></main>;
  const { user } = data;
  const navigation = [
    { href: homeFor(user.role), label: user.role === "admin" ? "Administration" : "Overview", icon: "◈" },
    ...(user.role === "customer" ? [{ href: "/customer/create-post", label: "New request", icon: "+" }, { href: "/customer/bookings", label: "My bookings", icon: "▤" }, { href: "/customer/tracking", label: "Track request", icon: "◎" }] : []),
    ...(user.role === "rider" ? [{ href: "/customer/bookings", label: "Job history", icon: "▤" }] : []),
    { href: "/customer/marketplace", label: "Marketplace", icon: "▦" }, { href: "/customer/messages", label: "Messages", icon: "✉" },
    { href: "/customer/notifications", label: "Notifications", icon: "♧" }, { href: "/customer/profile", label: "My profile", icon: "○" },
  ];
  const unread = data.notifications.filter(n => !n.read).length; const messages = data.conversations.reduce((sum, c) => sum + c.unread, 0);
  return <div className="min-h-screen">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between gap-4 px-5 lg:px-8">
      <Link href={homeFor(user.role)} className="flex items-center gap-2 text-xl font-extrabold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 text-white">P</span><span>Pasa<span className="text-orange-600">Buy</span><span className="ml-1 text-xs text-slate-400">PH</span></span></Link>
      <div className="flex items-center gap-3"><span className="hidden text-xs font-medium text-slate-500 sm:block">Your workspace</span><Link href="/customer/notifications" className="btn-secondary relative !px-3" aria-label={`Notifications, ${unread} unread`}>♧{unread > 0 && <span className="ml-1 text-xs text-orange-600">{unread}</span>}</Link><Link href="/customer/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-800" aria-label="My profile">{user.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</Link></div>
    </div></header>
    <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row"><aside className="border-b border-slate-200 bg-white lg:sticky lg:top-18 lg:h-[calc(100vh-4.5rem)] lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="hidden p-6 pb-4 lg:block"><p className="truncate text-sm font-bold">{user.name}</p><p className="mt-1 text-xs capitalize text-slate-500">{user.role} workspace</p></div>
      <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col">{navigation.map(item => <Link key={item.href} href={item.href} className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === item.href ? "bg-orange-50 text-orange-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`} aria-current={pathname === item.href ? "page" : undefined}><span className="text-lg" aria-hidden="true">{item.icon}</span>{item.label}{item.label === "Messages" && messages > 0 && <span className="badge !bg-orange-100 !text-orange-800">{messages}</span>}</Link>)}</nav>
      <div className="hidden p-5 lg:block"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-600">Everyday help, nearby.</p><p className="mt-2 text-xs leading-relaxed text-slate-500">Shopping, deliveries, rides, and your local marketplace.</p></div><button onClick={() => void logout()} disabled={signingOut} className="mt-5 text-sm font-medium text-slate-500 hover:text-red-600">{signingOut ? "Signing out…" : "Sign out →"}</button>{logoutError && <p className="error mt-2">{logoutError}</p>}</div>
    </aside><main id="main-content" className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:p-9">{error && <p className="notice mb-5" role="status">Connection interrupted. Showing your last saved data. <button onClick={() => void refresh()} className="font-bold underline">Retry</button></p>}{children}<footer className="mt-12 flex justify-between border-t border-slate-200 pt-5 text-xs text-slate-400"><span>PasaBuy PH · Your workspace</span><button className="text-slate-500 lg:hidden" disabled={signingOut} onClick={() => void logout()}>Sign out</button></footer>{logoutError && <p className="error lg:hidden">{logoutError}</p>}</main></div>
  </div>;
}
