"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import BookingCard, { EmptyBookings } from "@/components/BookingCard";
import { BookingStatus, statusLabels } from "@/lib/types";

export default function BookingsPage() {
  const { data, mutate } = useApp();
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!data) return null;
  const allBookings = data.bookings.filter(b => data.user.role === "admin" || (data.user.role === "rider" ? b.riderId === data.user.id : b.customerId === data.user.id));
  const filtered = allBookings.filter(b => (filter === "all" || b.status === filter) && `${b.id} ${b.title} ${b.pickup} ${b.destination} ${b.riderName || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  async function cancel() {
    if (!cancelId || busy) return;
    setBusy(true); setError("");
    try { await mutate("cancelBooking", { id: cancelId }); setCancelId(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not cancel the booking."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Everything in one place</p><h1 className="page-title mt-1">My bookings</h1><p className="muted mt-2">Your requests, from the first step to the last.</p></div>{data.user.role === "customer" && <Link href="/customer/create-post" className="btn">+ New request</Link>}</div>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["All requests", allBookings.length], ["Pending", allBookings.filter(b => b.status === "pending").length], ["In progress", allBookings.filter(b => b.status === "accepted" || b.status === "picked_up").length], ["Completed", allBookings.filter(b => b.status === "completed").length]].map(([label, value]) => <div key={label} className="card"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>)}</section>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by status">{(["all", ...Object.keys(statusLabels)] as (BookingStatus | "all")[]).map(status => <button key={status} type="button" onClick={() => setFilter(status)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${filter === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>{status === "all" ? "All" : statusLabels[status]}</button>)}</div><div className="w-full lg:w-72"><label htmlFor="booking-search" className="sr-only">Search bookings</label><input id="booking-search" type="search" value={search} onChange={e => setSearch(e.target.value)} className="field" placeholder="Search bookings…" /></div></div>
    {error && <p role="alert" className="error">{error}</p>}
    {cancelId && <div className="notice"><p className="font-semibold">Cancel this request?</p><p className="mt-1 text-sm">It will be removed from the available rider feed. This cannot be undone.</p><div className="mt-4 flex gap-3"><button className="btn-danger" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Yes, cancel request"}</button><button className="btn-secondary" disabled={busy} onClick={() => { setCancelId(null); setError(""); }}>Keep request</button></div></div>}
    <div className="space-y-4">{filtered.length ? filtered.map(booking => <BookingCard key={booking.id} booking={booking}><Link className="btn-secondary" href={`/customer/tracking?id=${booking.id}`}>View details & status</Link>{booking.status === "pending" && booking.customerId === data.user.id && <button className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" disabled={busy} onClick={() => { setCancelId(booking.id); setError(""); }}>Cancel request</button>}</BookingCard>) : <EmptyBookings title={allBookings.length ? "No matching bookings" : "Your first request starts here"} description={allBookings.length ? "Try another search or choose a different status." : "Create a Pasabuy, delivery, or ride request and manage it here."} create={!allBookings.length && data.user.role === "customer"} />}</div>
  </div>;
}
