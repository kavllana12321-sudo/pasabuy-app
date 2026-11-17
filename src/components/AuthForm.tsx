"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { homeFor, type User } from "@/lib/types";
import AuthShell from "./AuthShell";
import { useApp } from "./AppProvider";

type Mode = "login" | "customer" | "rider" | "reset";
type AuthResponse = { user: User; recoveryCode?: string; error?: string };

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [showDemo, setShowDemo] = useState(false);
  useEffect(() => { void fetch("/api/auth").then(r => r.json()).then(body => setShowDemo(body.demoEnabled === true)).catch(() => {}); }, []);
  const { refresh } = useApp();
  const registration = mode === "customer" || mode === "rider";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registered, setRegistered] = useState<AuthResponse | null>(null);
  const [savedCode, setSavedCode] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSuccess("");
    const form = new FormData(event.currentTarget);
    if ((registration || mode === "reset") && password !== form.get("confirmPassword")) { setError("Hindi magkapareho ang passwords. Please check both fields."); return; }
    const phone = String(form.get("phone") || "").trim();
    if (registration && !/^(09\d{9}|\+639\d{9})$/.test(phone)) { setError("Use a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX."); return; }
    const payload = mode === "login"
      ? { action: "login", email, password, remember: form.get("remember") === "on" }
      : mode === "reset" ? { action: "reset", email, password, recoveryCode: String(form.get("recoveryCode") || "").trim() }
      : { action: "register", email, password, role: mode, name: String(form.get("name") || "").trim(), phone, vehicle: form.get("vehicle") || "", plate: String(form.get("plate") || "").trim(), serviceArea: String(form.get("serviceArea") || "").trim() };
    setLoading(true);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data: AuthResponse = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to complete your request. Please try again.");
      if (registration) { setRegistered(data); return; }
      if (mode === "reset") { setSuccess("Password updated. Your recovery code has been used. Log in and generate a new code from your profile."); setPassword(""); return; }
      await refresh();
      router.replace(homeFor(data.user.role)); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cannot connect to the server. Please try again."); }
    finally { setLoading(false); }
  }

  if (registered) return <AuthShell><p className="eyebrow">Account created</p><h1 className="mt-3 text-2xl font-bold">Save your recovery code</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Keep this code somewhere private. You will need it to reset your password if you forget it. It will only be shown here once.</p><div className="my-6 rounded-xl border border-orange-200 bg-orange-50 p-4"><code className="block break-all text-lg font-bold tracking-wider text-orange-800">{registered.recoveryCode}</code><button type="button" className="mt-4 text-sm font-bold text-orange-700 underline" onClick={async () => { try { await navigator.clipboard.writeText(registered.recoveryCode || ""); setCopied(true); } catch { setError("Copy is unavailable. Please write down your code."); } }}>{copied ? "Copied!" : "Copy code"}</button></div>{mode === "rider" && <p className="notice mb-5">Your rider account needs admin approval before accepting requests. You can already update your profile.</p>}<label className="mb-5 flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" checked={savedCode} onChange={e => setSavedCode(e.target.checked)} className="mt-1" />I have saved my recovery code in a safe place.</label>{error && <p className="error mb-4" role="alert">{error}</p>}<button type="button" disabled={!savedCode} className="btn w-full" onClick={async () => { await refresh(); router.replace(homeFor(registered.user.role)); router.refresh(); }}>Continue to dashboard →</button></AuthShell>;

  return <AuthShell>
    {registration && <Link href="/register" className="text-sm font-semibold text-orange-600">← Account selection</Link>}
    <p className={`${registration ? "mt-6 " : ""}eyebrow`}>{mode === "login" ? "Welcome back" : mode === "reset" ? "Account recovery" : "Join PasaBuy PH"}</p>
    <h1 className="mt-3 text-3xl font-bold tracking-tight">{mode === "login" ? "Log in to your account" : mode === "reset" ? "Reset your password" : mode === "rider" ? "Become a rider" : "Create your account"}</h1>
    <p className="mt-3 text-sm leading-relaxed text-slate-500">{mode === "login" ? "Your errands, messages, and updates are waiting." : mode === "reset" ? "Enter the recovery code you saved at registration or generated in your profile. Keep your recovery code private; no reset email is sent." : mode === "rider" ? "Help your community with shopping, deliveries, and rides. An admin will review your rider details." : "Request a service, shop the marketplace, and connect with your rider."}</p>
    <form onSubmit={submit} className="mt-7 space-y-5">
      {registration && <div><label htmlFor="name" className="label">Full name</label><input className="field" id="name" name="name" autoComplete="name" placeholder="Juan Dela Cruz" minLength={2} maxLength={100} required /></div>}
      <div><label htmlFor="email" className="label">Email address</label><input className="field" id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={200} value={email} onChange={e => setEmail(e.target.value)} required /></div>
      {registration && <div><label htmlFor="phone" className="label">Mobile number</label><input className="field" id="phone" name="phone" type="tel" autoComplete="tel" placeholder="09123456789" pattern="(09[0-9]{9}|\+639[0-9]{9})" maxLength={13} required /><p className="mt-1 text-xs text-slate-500">09XXXXXXXXX or +639XXXXXXXXX</p></div>}
      {mode === "rider" && <><div><label htmlFor="serviceArea" className="label">Service area</label><input className="field" name="serviceArea" id="serviceArea" placeholder="e.g. Santa Cruz, Laguna" maxLength={150} required /></div><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="vehicle" className="label">Vehicle</label><select className="field" name="vehicle" id="vehicle" required defaultValue=""><option value="" disabled>Select vehicle</option><option value="motorcycle">Motorcycle</option><option value="bicycle">Bicycle</option><option value="car">Car</option></select></div><div><label htmlFor="plate" className="label">Plate / vehicle ID</label><input className="field" name="plate" id="plate" placeholder="Plate or bicycle ID" maxLength={30} required /></div></div><p className="text-xs leading-relaxed text-slate-500">For bicycles, enter an identifying vehicle name or serial number. Only motorcycle riders can accept Angkas requests.</p></>}
      {mode === "reset" && <div><label htmlFor="recoveryCode" className="label">Recovery code</label><input className="field" id="recoveryCode" name="recoveryCode" autoComplete="off" placeholder="Your saved recovery code" maxLength={100} required /></div>}
      <div><label htmlFor="password" className="label">{mode === "reset" ? "New password" : "Password"}</label><div className="relative"><input className="field pr-16" id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"} minLength={mode === "login" ? 1 : 8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">{showPassword ? "Hide" : "Show"}</button></div></div>
      {(registration || mode === "reset") && <div><label htmlFor="confirmPassword" className="label">Confirm password</label><input className="field" id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Enter your password again" minLength={8} maxLength={128} required /></div>}
      {mode === "login" && <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><label className="flex items-center gap-2 text-slate-600"><input type="checkbox" name="remember" />Remember me</label><Link href="/forgot-password" className="font-semibold text-orange-600">Forgot password?</Link></div>}
      {error && <p className="error" role="alert">{error}</p>}{success && <p className="success" role="status">{success}</p>}
      <button type="submit" className="btn w-full" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Log in →" : mode === "reset" ? "Update password" : "Create account →"}</button>
    </form>
    {mode === "login" && showDemo && <div className="mt-7 border-t border-slate-200 pt-6"><p className="text-sm font-bold">Explore the local system</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Choose an account to fill in its login details, then click Log in. All three use <code className="font-semibold">PasaBuy123!</code>.</p><div className="mt-3 grid grid-cols-3 gap-2">{["Customer", "Rider", "Admin"].map(role => <button key={role} type="button" disabled={loading} className="btn-secondary px-2 text-xs" onClick={() => { setEmail(`${role.toLowerCase()}@pasabuy.local`); setPassword("PasaBuy123!"); setError(""); }}>{role}</button>)}</div></div>}
    <p className="mt-7 text-center text-sm text-slate-500">{mode === "login" ? <>New here? <Link href="/register" className="font-bold text-orange-600">Create an account</Link></> : <>Already have an account? <Link href="/login" className="font-bold text-orange-600">Log in</Link></>}</p>
  </AuthShell>;
}

