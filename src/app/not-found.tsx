import Link from "next/link";
export default function NotFound() {
  return <main className="grid min-h-screen place-items-center px-5"><div className="card w-full max-w-lg text-center"><p className="eyebrow">PasaBuy PH · 404</p><h1 className="page-title mt-3">Page not found</h1><p className="muted mt-3">The page may have moved. Head back to PasaBuy to continue.</p><Link href="/" className="btn mt-6">Back to home</Link></div></main>;
}
