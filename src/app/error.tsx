"use client";
import Link from "next/link";
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return <section role="alert" className="mx-auto my-12 max-w-lg px-5"><div className="card"><p className="eyebrow">PasaBuy PH</p><h1 className="page-title mt-3">We couldn’t open this page</h1><p className="muted mt-3">Try opening it again. Your saved requests and messages are kept in your account.</p><div className="mt-6 flex gap-3"><button className="btn" onClick={retry}>Try again</button><Link className="btn-secondary" href="/">Back to home</Link></div></div></section>;
}
