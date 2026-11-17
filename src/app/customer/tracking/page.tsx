"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { BookingStatus as StatusBadge, EmptyBookings } from "@/components/BookingCard";
import { BookingStatus, dateTime, homeFor, money, serviceLabels, statusLabels } from "@/lib/types";

export default function TrackingPage() { return <Suspense fallback={<p className="muted">Loading booking…</p>}><TrackingContent /></Suspense>; }

const steps: { status: BookingStatus; description: string }[] = [
  { status: "pending", description: "Your request is posted for available riders." },
  { status: "accepted", description: "A rider has accepted and is preparing your request." },
  { status: "picked_up", description: "The rider has picked up the items or passenger." },
  { status: "completed", description: "The request has been completed by your rider." },
];

function TrackingContent() {
  const { data, mutate, refresh } = useApp();
  const query = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const [completePrompt, setCompletePrompt] = useState(false);
  if (!data) return null;
  const id = query.get("id");
  const own = data.bookings.filter(b => data.user.role === "admin" || b.customerId === data.user.id || b.riderId === data.user.id);
  const booking = id ? own.find(b => b.id === id) : own.find(b => b.status === "accepted" || b.status === "picked_up") || own[0];
  async function action(name: string) {
    if (!booking || busy) return;
    setBusy(true); setError("");
    try { const result = await mutate(name, { id: booking.id, bookingId: booking.id }); if (name === "startConversation") router.push(`/customer/messages?id=${result.id}`); setCancelPrompt(false); setCompletePrompt(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update this booking."); }
    finally { setBusy(false); }
  }
  if (!booking) return <div className="space-y-5"><h1 className="page-title">Booking status</h1><EmptyBookings title={id ? "Booking not found" : "No booking to track yet"} description={id ? "This request may not exist, or it belongs to another account." : "Create a request to see its progress here."} create={data.user.role === "customer"} /><Link href={homeFor(data.user.role)} className="btn-secondary">Back to dashboard</Link></div>;
  const riderViewing = booking.riderId === data.user.id;
  const canMessage = !!booking.riderId && (booking.customerId === data.user.id || riderViewing);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={data.user.role === "customer" ? "/customer/bookings" : homeFor(data.user.role)} className="text-sm font-semibold text-slate-500">← {data.user.role === "customer" ? "My bookings" : "Dashboard"}</Link><p className="eyebrow mt-6">{booking.id}</p><h1 className="page-title mt-1">{booking.title}</h1><p className="muted mt-2">{serviceLabels[booking.service]} · Created {dateTime(booking.createdAt)}</p></div><div className="flex items-center gap-3"><StatusBadge status={booking.status} /><button type="button" className="btn-secondary" disabled={busy} onClick={async () => { setBusy(true); try { await refresh(); } finally { setBusy(false); } }}>Refresh</button></div></div>
    {error && <p className="error" role="alert">{error}</p>}
    {booking.status === "cancelled" && <p className="notice">This request was cancelled. You can create a new request whenever you need a rider.</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="card"><h2 className="text-lg font-bold text-slate-900">Request progress</h2><p className="mt-2 text-xs leading-relaxed text-slate-500">Updates are recorded when the rider changes the booking status. This is status tracking, without a live GPS feed.</p><ol className="mt-7">{steps.map((step, i) => { const history = booking.history.find(h => h.status === step.status); return <li key={step.status} className="relative flex gap-4 pb-8 last:pb-0">{i < steps.length - 1 && <span className={`absolute bottom-0 left-[17px] top-9 w-px ${history ? "bg-orange-200" : "bg-slate-200"}`} />}<span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${history ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-400"}`}>{history ? "✓" : i + 1}</span><div><p className={`text-sm font-bold ${history ? "text-slate-900" : "text-slate-400"}`}>{statusLabels[step.status]}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{step.description}</p>{history && <p className="mt-2 text-xs font-medium text-orange-600">{dateTime(history.at)}</p>}</div></li>; })}{booking.status === "cancelled" && <li className="mt-6 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">Cancelled {dateTime(booking.updatedAt)}</li>}</ol></section>
      <div className="space-y-5"><section className="card"><h2 className="text-lg font-bold text-slate-900">Route & instructions</h2><div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Pickup / store</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{booking.pickup}</p><div className="my-3 h-5 border-l-2 border-dashed border-orange-300" /><p className="text-xs text-slate-500">Destination</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{booking.destination}</p>{booking.latitude !== null && booking.longitude !== null && <a href={`https://www.openstreetmap.org/?mlat=${booking.latitude}&mlon=${booking.longitude}#map=16/${booking.latitude}/${booking.longitude}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-orange-600">Open destination pin ↗</a>}</div><p className="mt-5 text-xs font-medium text-slate-500">Request details</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{booking.details}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><div><p className="text-xs text-slate-500">Service fee</p><p className="mt-1 text-xl font-bold text-slate-900">{money(booking.fee)}</p></div><p className="max-w-40 text-right text-xs leading-relaxed text-slate-500">Pay directly to the rider. Item costs are separate.</p></div></section>
      <section className="card"><p className="eyebrow">{riderViewing ? "Your customer" : "Your rider"}</p><h2 className="mt-2 text-lg font-bold text-slate-900">{riderViewing ? booking.customerName : booking.riderName || "Waiting for a rider"}</h2><p className="mt-2 text-sm text-slate-500">{riderViewing ? "Coordinate pickup and delivery details before proceeding." : booking.riderId ? "Message your rider for pickup or delivery arrangements." : "Approved riders can see your request and offered service fee."}</p>{canMessage && <button className="btn mt-5" type="button" disabled={busy} onClick={() => action("startConversation")}>Message {riderViewing ? "customer" : "rider"}</button>}{riderViewing && booking.phone && <a className="btn-secondary ml-2 mt-3" href={`tel:${booking.phone}`}>Call customer</a>}{riderViewing && (booking.status === "accepted" || booking.status === "picked_up") && <button type="button" disabled={busy} onClick={() => booking.status === "picked_up" ? setCompletePrompt(true) : action("advanceBooking")} className="btn mt-3 w-full">{booking.status === "accepted" ? "Confirm pickup / start trip" : "Confirm delivery / complete trip"}</button>}{riderViewing && booking.status === "picked_up" && completePrompt && <div className="notice mt-4"><p className="text-sm font-semibold">Has the customer received the delivery or reached the destination?</p><p className="mt-1 text-xs">Completing this request records the service fee and cannot be undone. Settle payment directly with the customer.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn" disabled={busy} onClick={() => action("advanceBooking")}>Yes, complete request</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => setCompletePrompt(false)}>Keep in progress</button></div></div>}</section>
      {booking.customerId === data.user.id && booking.status === "pending" && <section className="card">{cancelPrompt ? <><p className="text-sm font-semibold text-slate-800">Cancel this request? This cannot be undone.</p><div className="mt-4 flex flex-wrap gap-3"><button className="btn-danger" disabled={busy} onClick={() => action("cancelBooking")}>Yes, cancel request</button><button className="btn-secondary" disabled={busy} onClick={() => setCancelPrompt(false)}>Keep request</button></div></> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Plans changed?</p><button className="text-sm font-semibold text-red-600" onClick={() => setCancelPrompt(true)}>Cancel request</button></div>}</section>}
      </div>
    </div>
  </div>;
}

