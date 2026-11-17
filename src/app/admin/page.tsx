"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { BookingStatus } from "@/components/BookingCard";
import { dateTime, money, serviceLabels } from "@/lib/types";

export default function AdminDashboard() {
  const { data, mutate } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"riders" | "bookings" | "users">("riders");
  if (!data) return null;
  const riders = data.users.filter(u => u.role === "rider");
  const pending = riders.filter(u => !u.approved);
  const searchTerm = search.trim().toLowerCase();
  const users = data.users.filter(u => `${u.name} ${u.email} ${u.serviceArea}`.toLowerCase().includes(searchTerm));
  const bookings = data.bookings.filter(b => `${b.id} ${b.title} ${b.customerName} ${b.riderName || ""}`.toLowerCase().includes(searchTerm));
  async function approve(id: string, approved: boolean) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await mutate("approveRider", { id, approved }); setNotice(approved ? "Rider approved. They can now go online and accept requests." : "Rider approval removed. They cannot accept new requests."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update the rider."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-7">
    <div><p className="eyebrow">Administration</p><h1 className="page-title mt-1">Keep the community moving.</h1><p className="muted mt-2">Review rider accounts and monitor requests from one workspace.</p></div>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Registered customers", data.users.filter(u => u.role === "customer").length], ["Riders to review", pending.length], ["Total bookings", data.bookings.length], ["Completed service fees", money(data.bookings.filter(b => b.status === "completed").reduce((sum, b) => sum + b.fee, 0))]].map(([label, value]) => <div className="card" key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-words text-2xl font-bold text-slate-900">{value}</p></div>)}</section>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-2">{(["riders", "bookings", "users"] as const).map(item => <button key={item} type="button" onClick={() => { setTab(item); setSearch(""); }} className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${tab === item ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500"}`}>{item === "riders" ? `Rider review (${pending.length})` : item}</button>)}</div><div className="w-full sm:w-72"><label htmlFor="admin-search" className="sr-only">Search {tab}</label><input id="admin-search" type="search" className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab}…`} /></div></div>
    {tab === "riders" && <section className="space-y-4">{users.filter(u => u.role === "rider").sort((a, b) => Number(a.approved) - Number(b.approved)).map(rider => <article key={rider.id} className="card"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">{rider.name}</h2><p className="mt-1 break-all text-sm text-slate-500">{rider.email}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${rider.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{rider.approved ? "Approved" : "Awaiting review"}</span></div><dl className="mt-5 grid gap-4 sm:grid-cols-4">{[["Mobile", rider.phone || "Not provided"], ["Service area", rider.serviceArea || "Not provided"], ["Vehicle", rider.vehicle || "Not provided"], ["Plate number", rider.plate || "Not provided"]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd></div>)}</dl><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-400">Registered {dateTime(rider.createdAt)}</p><button className={rider.approved ? "btn-secondary" : "btn"} disabled={busy} onClick={() => approve(rider.id, !rider.approved)}>{rider.approved ? "Remove approval" : "Approve rider"}</button></div></article>)}{!users.some(u => u.role === "rider") && <p className="card py-12 text-center text-sm text-slate-500">No riders match your search.</p>}<p className="text-xs text-slate-500">Approval gives access to customer requests. Verify rider information before approving an account.</p></section>}
    {tab === "bookings" && <section className="card overflow-hidden !p-0"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Request", "Customer / rider", "Status", "Service fee", ""].map((title, i) => <th key={i} className="px-5 py-4 font-semibold">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{bookings.map(booking => <tr key={booking.id}><td className="max-w-64 px-5 py-4"><p className="font-semibold text-slate-900">{booking.title}</p><p className="mt-1 text-xs text-slate-500">{serviceLabels[booking.service]} · {booking.id}</p></td><td className="px-5 py-4"><p className="text-slate-800">{booking.customerName}</p><p className="mt-1 text-xs text-slate-500">{booking.riderName || "No rider yet"}</p></td><td className="px-5 py-4"><BookingStatus status={booking.status} /></td><td className="px-5 py-4 font-semibold">{money(booking.fee)}</td><td className="px-5 py-4"><Link href={`/customer/tracking?id=${booking.id}`} className="font-semibold text-orange-600">View →</Link></td></tr>)}</tbody></table></div>{!bookings.length && <p className="p-10 text-center text-sm text-slate-500">No bookings to display.</p>}</section>}
    {tab === "users" && <section className="card overflow-hidden !p-0"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Name", "Email", "Role", "Registered"].map(label => <th key={label} className="px-5 py-4 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{users.map(user => <tr key={user.id}><td className="px-5 py-4 font-semibold text-slate-900">{user.name}</td><td className="px-5 py-4 text-slate-500">{user.email}</td><td className="px-5 py-4 capitalize text-slate-700">{user.role}</td><td className="px-5 py-4 text-slate-500">{dateTime(user.createdAt)}</td></tr>)}</tbody></table></div>{!users.length && <p className="p-10 text-center text-sm text-slate-500">No users match your search.</p>}</section>}
  </div>;
}
