import Link from "next/link";

const services = [
  { number: "01", title: "Pasabuy", description: "Ilista ang kailangan mong ipabili. Isang rider ang bahala sa shopping at delivery.", icon: "🛍️" },
  { number: "02", title: "Pickup & Delivery", description: "Magpadala ng documents at small packages mula pickup hanggang destination.", icon: "📦" },
  { number: "03", title: "Angkas", description: "Mag-request ng motorcycle ride at sundan ang bawat update ng biyahe.", icon: "🛵" },
  { number: "04", title: "Marketplace", description: "Mag-post ng produkto, magtanong sa seller, at makipag-usap sa community.", icon: "🏪" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5" aria-label="Main navigation">
          <Link href="/" className="text-2xl font-extrabold tracking-tight">Pasa<span className="text-orange-600">Buy</span><span className="ml-1 text-xs font-bold text-slate-400">PH</span></Link>
          <div className="flex items-center gap-3"><Link href="/login" className="btn-secondary">Log in</Link><Link href="/register" className="btn">Get started</Link></div>
        </nav>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Your everyday errands, made easier</p>
          <h1 className="mt-5 max-w-xl text-5xl font-extrabold leading-[1.12] tracking-tight sm:text-6xl">May kailangan ka?<br /><span className="text-orange-600">Ipa-PasaBuy mo.</span></h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">Pabili, padala, o pahatid. Connect with a rider, manage your requests, and keep every update in one place.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/register/customer" className="btn">Create a customer account <span aria-hidden="true">→</span></Link><Link href="/register/rider" className="btn-secondary">Become a rider</Link></div>
          <p className="mt-6 text-sm leading-relaxed text-slate-500">Create your account to request a service or join as a rider.</p>
        </div>
        <div className="relative rounded-[2rem] border border-orange-100 bg-orange-50 p-6 sm:p-10">
          <div className="mb-6 flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-2xl" aria-hidden="true">🛵</span><div><p className="font-bold">One request. Every update.</p><p className="text-sm text-slate-500">A simpler way to get things done</p></div></div>
          <div className="space-y-3">
            {[{ title: "Tell us what you need", text: "Choose a service and add your locations." }, { title: "Connect with a rider", text: "An available rider accepts your request." }, { title: "Stay in the loop", text: "Message your rider and follow status updates." }].map((step, i) => <div key={step.title} className="flex gap-4 rounded-2xl border border-white bg-white/90 p-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">{i + 1}</span><div><h2 className="font-bold">{step.title}</h2><p className="mt-1 text-sm leading-relaxed text-slate-500">{step.text}</p></div></div>)}
          </div>
          <p className="mt-6 text-sm text-slate-600">Cash payment is arranged directly with your rider or seller.</p>
        </div>
      </section>
      <section id="services" className="mx-auto max-w-6xl px-5 pb-20">
        <p className="eyebrow">What can we help with?</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Everyday services, in one place.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map(service => <Link href="/login" key={service.title} className="card block p-6 transition hover:-translate-y-1 hover:border-orange-300"><div className="flex items-center justify-between"><span className="text-3xl" aria-hidden="true">{service.icon}</span><span className="text-xs font-bold text-slate-300">{service.number}</span></div><h3 className="mt-6 text-lg font-bold">{service.title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-500">{service.description}</p><span className="mt-5 inline-block text-sm font-semibold text-orange-600">Get started →</span></Link>)}</div>
      </section>
      <footer className="border-t border-slate-200 px-5 py-6 text-center text-sm text-slate-500">PasaBuy PH · Made for your everyday errands</footer>
    </main>
  );
}
