"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import BookingCard, { EmptyBookings } from "@/components/BookingCard";
import { dateTime } from "@/lib/types";

const services = [
  { title: "Pasabuy", description: "Groceries, food, and everyday essentials.", mark: "01", href: "/customer/create-post?service=pasabuy" },
  { title: "Pickup & Delivery", description: "Send parcels, documents, and small items.", mark: "02", href: "/customer/create-post?service=pickup" },
  { title: "Angkas", description: "Request a motorcycle ride to your destination.", mark: "03", href: "/customer/create-post?service=angkas" },
  { title: "Marketplace", description: "Buy and sell with your local community.", mark: "04", href: "/customer/marketplace" },
];

export default function CustomerDashboard() {
  const { data } = useApp();
  if (!data) return null;
  const ownBookings = data.bookings.filter(b => b.customerId === data.user.id);
  const active = ownBookings.filter(b => b.status === "accepted" || b.status === "picked_up");
  const stats = [
    ["Total requests", ownBookings.length],
    ["Waiting for a rider", ownBookings.filter(b => b.status === "pending").length],
    ["In progress", active.length],
    ["Completed", ownBookings.filter(b => b.status === "completed").length],
  ];
  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-8 text-white sm:p-10">
      <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full border-[35px] border-white/5" aria-hidden="true" />
      <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Your everyday errands, made easier</p>
      <h1 className="relative mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Hello, {data.user.name.split(" ")[0]}.</h1>
      <p className="relative mt-3 max-w-lg text-sm leading-relaxed text-slate-300">Anong kailangan mo today? Book a rider, send a package, or discover something in your neighborhood.</p>
      <Link className="btn relative mt-6" href="/customer/create-post">+ Create a request</Link>
    </section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Booking summary">{stats.map(([label, value]) => <div key={label} className="card"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p></div>)}</section>
    <section><div className="mb-4"><p className="eyebrow">How can we help?</p><h2 className="mt-1 text-xl font-bold text-slate-900">Choose a service</h2></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map(service => <Link key={service.title} href={service.href} className="card group transition hover:border-orange-300 hover:shadow-sm"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-sm font-bold text-orange-600">{service.mark}</span><h3 className="mt-5 font-bold text-slate-900">{service.title} <span className="float-right text-orange-500 transition group-hover:translate-x-1">↗</span></h3><p className="mt-2 text-sm leading-relaxed text-slate-500">{service.description}</p></Link>)}</div></section>
    <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-900">Recent requests</h2><Link className="text-sm font-semibold text-orange-600" href="/customer/bookings">View all →</Link></div><div className="space-y-4">{ownBookings.length ? ownBookings.slice(0, 3).map(booking => <BookingCard key={booking.id} booking={booking}><Link className="btn-secondary" href={`/customer/tracking?id=${booking.id}`}>View request</Link></BookingCard>) : <EmptyBookings create />}</div></section>
      <section className="card"><div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">Latest updates</h2><Link href="/customer/notifications" className="text-xs font-semibold text-orange-600">View all</Link></div>{data.notifications.length ? <div className="mt-4 divide-y divide-slate-100">{data.notifications.slice(0, 4).map(n => <Link key={n.id} href={n.href} className="block py-4 first:pt-0"><p className="text-sm font-semibold text-slate-800">{n.title}</p><p className="mt-1 text-sm text-slate-500">{n.text}</p><p className="mt-2 text-xs text-slate-400">{dateTime(n.createdAt)}</p></Link>)}</div> : <p className="mt-5 text-sm leading-relaxed text-slate-500">Booking and message updates will appear here.</p>}<div className="mt-5 rounded-xl bg-orange-50 p-4"><p className="text-sm font-semibold text-orange-900">Simple, direct payments</p><p className="mt-1 text-xs leading-relaxed text-orange-800">Agree on your service fee before booking. Pay the rider directly; item costs are separate.</p></div></section>
    </div>
  </div>;
}
