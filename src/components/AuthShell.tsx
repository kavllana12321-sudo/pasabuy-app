import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#f6f7fb] px-4 py-8 sm:py-12"><div className="mx-auto max-w-lg"><Link href="/" className="mb-8 inline-block text-2xl font-extrabold tracking-tight">Pasa<span className="text-orange-600">Buy</span><span className="ml-1 text-xs text-slate-400">PH</span></Link><div className="card p-6 sm:p-9">{children}</div><p className="mt-6 text-center text-xs leading-relaxed text-slate-500">Your workspace · Data is saved on this computer.</p></div></main>;
}
