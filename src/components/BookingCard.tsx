"use client";

import Link from "next/link";
import { Booking, dateTime, money, serviceLabels, statusLabels } from "@/lib/types";

const tones = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  accepted: "bg-blue-50 text-blue-800 border-blue-200",
  picked_up: "bg-violet-50 text-violet-800 border-violet-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

export function BookingStatus({ status }: { status: Booking["status"] }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tones[status]}`}>{statusLabels[status]}</span>;
}

export default function BookingCard({ booking, children, showCustomer = false }: { booking: Booking; children?: React.ReactNode; showCustomer?: boolean }) {
  return (
    <article className="card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{serviceLabels[booking.service]}</p>
          <h3 className="mt-1 break-words text-lg font-bold text-slate-900">{booking.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{booking.id} · {dateTime(booking.createdAt)}</p>
        </div>
        <BookingStatus status={booking.status} />
      </div>
      <div className="my-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <div><p className="text-xs font-medium text-slate-500">Pickup</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{booking.pickup}</p></div>
        <div><p className="text-xs font-medium text-slate-500">Destination</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{booking.destination}</p></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs text-slate-500">Offered service fee</p><p className="text-lg font-bold text-slate-900">{money(booking.fee)}</p></div>
        <p className="text-sm text-slate-500">{showCustomer ? `Customer: ${booking.customerName}` : booking.riderName ? `Rider: ${booking.riderName}` : "Waiting for a rider"}</p>
      </div>
      {children && <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{children}</div>}
    </article>
  );
}

export function EmptyBookings({ title = "No bookings yet", description = "Your requests will appear here once you create a booking.", create = false }: { title?: string; description?: string; create?: boolean }) {
  return <div className="card py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl" aria-hidden="true">↗</span><h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>{create && <Link href="/customer/create-post" className="btn mt-6">Create a request</Link>}</div>;
}
