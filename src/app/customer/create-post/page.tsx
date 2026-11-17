"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { money, Service, serviceLabels } from "@/lib/types";

export default function CreatePostPage() { return <Suspense fallback={<p className="muted">Loading request form…</p>}><RequestForm /></Suspense>; }

function RequestForm() {
  const { data, mutate } = useApp();
  const query = useSearchParams();
  const router = useRouter();
  const initial = query.get("service");
  const [service, setService] = useState<Service>(initial === "pickup" || initial === "angkas" ? initial : "pasabuy");
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationText, setLocationText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    if ([fields.title, fields.details, fields.pickup, fields.destination].some(value => value.trim().length < 3)) { setError("Enter at least 3 characters for the title, instructions, and both addresses."); return; }
    if (!/^(09\d{9}|\+639\d{9})$/.test(fields.phone.replace(/[\s-]/g, ""))) { setError("Enter a valid Philippine mobile number, such as 09171234567."); return; }
    if (!Number.isFinite(Number(fields.fee)) || (Number(fields.fee) < 20 || Number(fields.fee) > 10000)) { setError("Please offer a service fee between PHP 20 and PHP 10,000."); return; }
    setPreview(fields);
  }
  async function confirm() {
    if (!preview || busy) return;
    setBusy(true); setError("");
    try { const result = await mutate("createBooking", { ...preview, fee: Number(preview.fee), service, ...coordinates }); router.push(`/customer/tracking?id=${result.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not create the request."); setBusy(false); }
  }
  function locate() {
    if (!navigator.geolocation) { setLocationText("Location is unavailable. Your written address is enough to book."); return; }
    setLocationText("Finding your location…");
    navigator.geolocation.getCurrentPosition(p => { setCoordinates({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setLocationText("Current location attached to the destination. Please also write the complete address."); }, () => setLocationText("Could not get your location. You can continue with the written address."), { timeout: 10000, maximumAge: 60000 });
  }
  return <div className="mx-auto max-w-3xl space-y-6">
    <div><Link href="/customer" className="text-sm font-semibold text-slate-500">← Dashboard</Link><p className="eyebrow mt-6">Let’s get it done</p><h1 className="page-title mt-1">Create a request</h1><p className="muted mt-2">Add the details. An available rider can accept your request.</p></div>
    <div className="grid grid-cols-3 gap-2" aria-label="Choose service">{(Object.keys(serviceLabels) as Service[]).map((item, i) => <button key={item} onClick={() => { setService(item); setPreview(null); }} disabled={busy} className={`rounded-2xl border p-3 text-left text-sm font-semibold transition sm:p-5 ${service === item ? "border-orange-400 bg-orange-50 text-orange-800 ring-1 ring-orange-400" : "border-slate-200 bg-white text-slate-600 hover:border-orange-200"}`}><span className="mb-3 block text-xs opacity-60">0{i + 1}</span>{serviceLabels[item]}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <form onSubmit={review} className={preview ? "hidden" : "card space-y-5"}>
      <div><label className="label" htmlFor="title">Request title</label><input id="title" name="title" required minLength={3} maxLength={120} className="field" placeholder={service === "pasabuy" ? "e.g. Grocery shopping at the public market" : service === "pickup" ? "e.g. Deliver documents to the office" : "e.g. Ride to Laguna University"} /></div>
      <div><label className="label" htmlFor="details">{service === "pasabuy" ? "Shopping list and instructions" : service === "pickup" ? "Package details and instructions" : "Passenger and ride details"}</label><textarea id="details" name="details" required minLength={3} maxLength={3000} rows={5} className="field" placeholder={service === "pasabuy" ? "List quantities, brands, budget, and any substitutes." : service === "pickup" ? "Describe the package size, contents, and handling instructions." : "One passenger. Include any important pickup instructions."} /></div>
      <div className="grid gap-5 sm:grid-cols-2"><div><label className="label" htmlFor="pickup">{service === "pasabuy" ? "Store / shopping location" : "Pickup address"}</label><textarea id="pickup" name="pickup" required minLength={3} maxLength={250} rows={3} className="field" placeholder="Store or building, street, barangay, town" /></div><div><label className="label" htmlFor="destination">Destination address</label><textarea id="destination" name="destination" required minLength={3} maxLength={250} rows={3} className="field" defaultValue={data.user.address} placeholder="House / building, street, barangay, town" /></div></div>
      <div className="rounded-xl border border-dashed border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">Destination location <span className="font-normal text-slate-400">(optional)</span></p><p className="mt-1 text-xs text-slate-500">Use this only if you are at the destination now.</p></div><button type="button" className="btn-secondary" onClick={locate}>Use my location</button></div>{locationText && <p className="mt-3 text-xs text-slate-600" role="status">{locationText}</p>}{coordinates && <button type="button" onClick={() => { setCoordinates(null); setLocationText(""); }} className="mt-2 text-xs font-semibold text-orange-600">Remove location</button>}</div>
      <div className="grid gap-5 sm:grid-cols-2"><div><label className="label" htmlFor="phone">Contact number</label><input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={20} defaultValue={data.user.phone} className="field" placeholder="09171234567" /></div><div><label className="label" htmlFor="fee">Offered service fee (PHP)</label><input id="fee" name="fee" type="number" min="20" max="10000" step="0.01" required className="field" placeholder="e.g. 80" /></div></div>
      <p className="notice text-sm">The service fee is paid directly to the rider. Shopping costs are separate. Confirm the item budget and payment arrangements in messages.</p>
      <label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" required className="mt-1 accent-orange-500" /><span>I have checked the addresses and request details.</span></label>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><Link href="/customer/bookings" className="btn-secondary">Cancel</Link><button className="btn" type="submit">Review request →</button></div>
    </form>
    {preview && <section className="card space-y-5"><div><p className="eyebrow">One final check</p><h2 className="mt-1 text-xl font-bold text-slate-900">Review your request</h2></div><dl className="grid gap-5 sm:grid-cols-2">{[["Service", serviceLabels[service]], ["Title", preview.title], ["Pickup", preview.pickup], ["Destination", preview.destination], ["Contact", preview.phone], ["Service fee", money(Number(preview.fee))]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>)}</dl><div><p className="text-xs text-slate-500">Details</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{preview.details}</p></div><p className="notice text-sm">Your request becomes visible to approved riders. You can cancel while it is waiting for a rider.</p><div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" disabled={busy} onClick={() => setPreview(null)}>Edit details</button><button type="button" className="btn" disabled={busy} onClick={confirm}>{busy ? "Creating request…" : "Confirm & post request"}</button></div></section>}
  </div>;
}


