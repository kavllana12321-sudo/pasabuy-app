"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import BookingCard, { EmptyBookings } from "@/components/BookingCard";
import { money, Service, serviceLabels } from "@/lib/types";

export default function RiderDashboard() {
  const { data, mutate } = useApp();
  const router = useRouter();
  const [service, setService] = useState<Service | "all">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  if (!data) return null;
  const own = data.bookings.filter(b => b.riderId === data.user.id);
  const active = own.find(b => b.status === "accepted" || b.status === "picked_up");
  const completed = own.filter(b => b.status === "completed");
  const available = data.bookings.filter(b => b.status === "pending" && (service === "all" || b.service === service) && `${b.title} ${b.pickup} ${b.destination}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function run(action: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try { const result = await mutate(action, payload); if (action === "startConversation") router.push(`/customer/messages?id=${result.id}`); if (action === "acceptBooking") setSelected(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update your account."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-7">
    <section className="flex flex-col justify-between gap-6 rounded-3xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:p-8"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300">Rider workspace</p><h1 className="mt-2 text-3xl font-bold">Ready for the next errand?</h1><p className="mt-3 max-w-xl text-sm text-slate-300">Hello, {data.user.name.split(" ")[0]}. Choose a request, coordinate with your customer, and keep them updated along the way.</p></div><div className="shrink-0"><button type="button" disabled={busy || !data.user.approved} onClick={() => run("setAvailability", { available: !data.user.available })} className={`flex min-w-44 items-center justify-center gap-3 rounded-xl border px-5 py-3 text-sm font-bold transition ${data.user.available && data.user.approved ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-white/20 bg-white/5 text-slate-300"}`}><span className={`h-2.5 w-2.5 rounded-full ${data.user.available && data.user.approved ? "bg-emerald-400" : "bg-slate-500"}`} />{data.user.available && data.user.approved ? "Online · Go offline" : "Offline · Go online"}</button><p className="mt-2 text-center text-xs text-slate-400">{data.user.serviceArea || "Set your service area in Profile"}</p></div></section>
    {!data.user.approved && <div className="notice"><p className="font-semibold">Your rider account is awaiting approval.</p><p className="mt-1 text-sm">An administrator must approve your account before you can accept bookings. You can update your vehicle and contact details in your profile.</p><Link className="mt-3 inline-block text-sm font-semibold text-orange-700" href="/customer/profile">Review profile →</Link></div>}
    {error && <p className="error" role="alert">{error}</p>}
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Completed jobs", completed.length], ["Recorded service fees", money(completed.reduce((sum, b) => sum + b.fee, 0))], ["Current job", active ? "1" : "0"], ["Account status", data.user.approved ? "Approved" : "Pending"]].map(([label, value]) => <div className="card" key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-words text-xl font-bold text-slate-900 sm:text-2xl">{value}</p></div>)}</section>
    {active && <section><div className="mb-4 flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-orange-500" /><h2 className="text-xl font-bold text-slate-900">Your current job</h2></div><BookingCard booking={active} showCustomer><Link href={`/customer/tracking?id=${active.id}`} className="btn">Open job & update status</Link><button className="btn-secondary" disabled={busy} onClick={() => run("startConversation", { bookingId: active.id })}>Message customer</button></BookingCard><p className="mt-3 text-xs text-slate-500">Complete this request before accepting another one. Recorded fees reflect completed bookings; payments are settled directly.</p></section>}
    <section><div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Find your next job</p><h2 className="mt-1 text-xl font-bold text-slate-900">Available requests</h2></div><div className="w-full sm:w-72"><label className="sr-only" htmlFor="job-search">Search requests</label><input id="job-search" className="field" type="search" placeholder="Search title or location…" value={search} onChange={e => setSearch(e.target.value)} /></div></div><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{(["all", ...Object.keys(serviceLabels)] as (Service | "all")[]).map(item => <button type="button" key={item} onClick={() => setService(item)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${item === service ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500"}`}>{item === "all" ? "All services" : serviceLabels[item]}</button>)}</div>
      {!data.user.approved ? <EmptyBookings title="Finish account approval first" description="Approved riders can view customer requests and go online to accept a job." /> : available.length ? <div className="grid items-start gap-4 xl:grid-cols-2">{available.map(booking => <BookingCard key={booking.id} booking={booking} showCustomer><button className="btn-secondary" onClick={() => setSelected(selected === booking.id ? null : booking.id)}>{selected === booking.id ? "Hide details" : "Review request"}</button>{selected === booking.id && <div className="w-full space-y-4"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{booking.details}</p><p className="text-xs leading-relaxed text-slate-500">By accepting, you agree to fulfill this request for the offered service fee. Confirm item costs and payment arrangements with the customer.</p><button className="btn" disabled={busy || !data.user.available || !!active || (booking.service === "angkas" && data.user.vehicle.toLowerCase() !== "motorcycle")} onClick={() => run("acceptBooking", { id: booking.id })}>{busy ? "Please wait…" : active ? "Finish your current job first" : booking.service === "angkas" && data.user.vehicle.toLowerCase() !== "motorcycle" ? "Motorcycle required for Angkas" : !data.user.available ? "Go online to accept" : "Accept this request"}</button></div>}</BookingCard>)}</div> : <EmptyBookings title="No available requests" description="New customer requests appear here automatically. Try a different service filter or check back in a moment." />}
    </section>
    {completed.length > 0 && <section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Recently completed</h2><Link href="/customer/bookings" className="text-sm font-semibold text-orange-600">View history →</Link></div><div className="space-y-4">{completed.slice(0, 3).map(booking => <BookingCard key={booking.id} booking={booking} showCustomer><Link className="btn-secondary" href={`/customer/tracking?id=${booking.id}`}>View receipt details</Link></BookingCard>)}</div></section>}
  </div>;
}


