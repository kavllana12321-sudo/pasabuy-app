"use client";
import { useState, type FormEvent } from "react";
import { useApp } from "@/components/AppProvider";
import { dateTime } from "@/lib/types";
export default function ProfilePage() {
  const { data, mutate } = useApp(); const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [code, setCode] = useState(""); const [vehicle, setVehicle] = useState<string | null>(null);
  if (!data) return null; const user = data.user;
  async function save(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); if (busy) return; const form = event.currentTarget; const values = new FormData(form);
    setBusy(action); setError(""); setSuccess("");
    try {
      if (action === "changePassword" && values.get("password") !== values.get("confirmPassword")) throw new Error("New passwords do not match.");
      const payload = Object.fromEntries(values.entries());
      const result = await mutate(action, payload);
      if (action === "regenerateRecovery") { setCode(String(result.recoveryCode)); setSuccess("New recovery code generated. The previous code no longer works."); form.reset(); }
      else if (action === "changePassword") { setSuccess("Password updated. Other sessions have been signed out."); form.reset(); }
      else setSuccess("Your profile has been saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update your profile."); }
    finally { setBusy(""); }
  }
  return <>
    <div className="mb-7"><p className="eyebrow">Your account</p><h1 className="page-title">My profile</h1><p className="muted mt-2">Keep your contact information and account security up to date.</p></div>
    {error && <p className="error mb-5" role="alert">{error}</p>}{success && <p className="success mb-5" role="status">{success}</p>}
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_330px]">
      <section className="card"><div className="mb-6 flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-100 text-xl font-bold text-orange-800">{user.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</div><div><h2 className="text-lg font-bold">{user.name}</h2><p className="muted capitalize">{user.role} account</p></div></div>
        <form onSubmit={e => void save(e, "updateProfile")} className="space-y-4"><label className="label">Full name<input className="field mt-2" name="name" autoComplete="name" defaultValue={user.name} required minLength={2} maxLength={100} /></label><label className="label">Email address<input className="field mt-2 !bg-slate-50" type="email" value={user.email} readOnly /><span className="mt-2 block text-xs font-normal text-slate-400">Used to sign in. Email changes are not supported in this local workspace.</span></label><label className="label">Mobile number<input className="field mt-2" name="phone" type="tel" autoComplete="tel" defaultValue={user.phone} placeholder="09XXXXXXXXX" required pattern="(09[0-9]{9}|\+639[0-9]{9})" title="Use 09XXXXXXXXX or +639XXXXXXXXX" /></label><label className="label">Default address<input className="field mt-2" name="address" autoComplete="street-address" defaultValue={user.address} maxLength={250} placeholder="Street, barangay, city" /></label>
          {user.role === "rider" && <fieldset className="space-y-4 rounded-xl bg-slate-50 p-4"><legend className="px-1 text-sm font-bold">Rider details</legend><label className="label">Vehicle<select name="vehicle" className="field mt-2" value={vehicle || user.vehicle.toLowerCase()} onChange={event => setVehicle(event.target.value)} required><option value="motorcycle">Motorcycle</option><option value="bicycle">Bicycle</option><option value="car">Car</option></select></label><label className="label">Plate number<input className="field mt-2" name="plate" defaultValue={user.plate} required={(vehicle || user.vehicle.toLowerCase()) !== "bicycle"} minLength={(vehicle || user.vehicle.toLowerCase()) === "bicycle" ? undefined : 2} maxLength={30} /></label><label className="label">Service area<input className="field mt-2" name="serviceArea" defaultValue={user.serviceArea} required minLength={2} maxLength={150} /></label><p className="text-xs text-slate-500">Changing vehicle, plate, or service area requires admin approval again. Finish any active job first.</p></fieldset>}
          <button className="btn" disabled={!!busy}>{busy === "updateProfile" ? "Saving…" : "Save changes"}</button>
        </form>
      </section>
      <div className="space-y-6"><section className="card"><h2 className="font-bold">Account details</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-slate-500">Member since</dt><dd className="mt-1 font-medium">{dateTime(user.createdAt)}</dd></div><div><dt className="text-slate-500">Account type</dt><dd className="mt-1 font-medium capitalize">{user.role}</dd></div>{user.role === "rider" && <div><dt className="text-slate-500">Rider approval</dt><dd className={`badge mt-2 ${user.approved ? "!bg-emerald-50 !text-emerald-700" : "!bg-amber-50 !text-amber-700"}`}>{user.approved ? "Approved" : "Pending admin approval"}</dd></div>}</dl></section><section className="card"><h2 className="font-bold">Change password</h2><form className="mt-4 space-y-4" onSubmit={e => void save(e, "changePassword")}><label className="label">Current password<input className="field mt-2" name="currentPassword" type="password" autoComplete="current-password" required /></label><label className="label">New password<input className="field mt-2" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label><label className="label">Confirm new password<input className="field mt-2" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label><button className="btn-secondary w-full" disabled={!!busy}>{busy === "changePassword" ? "Updating…" : "Update password"}</button></form></section></div>
    </div>
    <section className="card mt-6"><h2 className="font-bold">Recovery code</h2><p className="muted mt-2 max-w-2xl">Your account uses a recovery code instead of email to reset a forgotten password. Save your code somewhere private. Generating a new code replaces the previous one.</p><form className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end" onSubmit={e => void save(e, "regenerateRecovery")}><label className="label mb-0 flex-1">Confirm current password<input className="field mt-2" name="currentPassword" type="password" autoComplete="current-password" required /></label><button className="btn-secondary shrink-0" disabled={!!busy}>{busy === "regenerateRecovery" ? "Generating…" : "Generate new code"}</button></form>{code && <div className="notice mt-5"><p className="font-bold">Save this code now. It is only shown here once.</p><code className="mt-3 block select-all break-all rounded-lg bg-white p-4 font-mono text-lg">{code}</code><button type="button" className="mt-3 text-sm font-semibold underline" onClick={() => { setCode(""); }}>I have saved my code</button></div>}</section>
  </>;
}

