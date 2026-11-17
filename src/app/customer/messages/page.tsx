"use client";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { dateTime } from "@/lib/types";
export default function MessagesPage() { return <Suspense fallback={<p className="muted">Loading messages…</p>}><Messages /></Suspense>; }
function Messages() {
  const { data, mutate } = useApp(); const query = useSearchParams(); const router = useRouter();
  const [search, setSearch] = useState(""); const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const conversations = data?.conversations || [];
  const requestedId = query.get("id");
  const firstId = conversations[0]?.id;
  const activeId = requestedId || firstId;
  const text = activeId ? drafts[activeId] || "" : "";
  function setText(value: string) { if (activeId) setDrafts(previous => ({ ...previous, [activeId]: value })); }
  const active = conversations.find(c => c.id === activeId);
  const unread = active?.unread || 0;
  useEffect(() => { if (!requestedId && firstId) router.replace(`/customer/messages?id=${firstId}`, { scroll: false }); }, [requestedId, firstId, router]);
  useEffect(() => { if (activeId && unread > 0) { void mutate("readConversation", { id: activeId }).catch(() => {}); } }, [activeId, unread, mutate]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "instant", block: "nearest" }); }, [activeId, active?.messages.length]);
  if (!data) return null;
  const userId = data.user.id;
  const filtered = conversations.filter(c => `${c.otherName} ${c.subject}`.toLowerCase().includes(search.toLowerCase()));
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!text.trim() || !activeId || busy) return;
    setBusy(true); setError("");
    try { await mutate("sendMessage", { id: activeId, text: text.trim() }); setText(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Message could not be sent."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="mb-7"><p className="eyebrow">Stay connected</p><h1 className="page-title">Messages</h1><p className="muted mt-2">Coordinate your request or ask a seller about an item.</p></div>
    {conversations.length === 0 ? <div className="card py-16 text-center"><div className="mb-4 text-4xl">✉</div><h2 className="text-lg font-bold">Your conversations will appear here</h2><p className="muted mx-auto mt-2 max-w-md">Message a seller from the marketplace, or start a chat from an accepted booking.</p><Link className="btn mt-5" href="/customer/marketplace">Explore marketplace</Link></div> : <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[270px_1fr]">
      <aside className="border-b border-slate-200 md:border-r md:border-b-0"><div className="p-4"><input aria-label="Search conversations" className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…" /></div><div className="max-h-52 overflow-y-auto md:max-h-[560px]">{filtered.length === 0 && <p className="muted px-4 pb-5">No conversations match.</p>}{filtered.map(c => <button key={c.id} disabled={busy} onClick={() => { router.replace(`/customer/messages?id=${c.id}`, { scroll: false }); setError(""); }} className={`flex w-full gap-3 border-t border-slate-100 p-4 text-left transition ${c.id === activeId ? "bg-orange-50" : "hover:bg-slate-50"}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold">{c.otherName.split(" ").map(n => n[0]).slice(0, 2).join("")}</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2 text-sm font-bold">{c.otherName}{c.unread > 0 && <span className="badge !bg-orange-100 !text-orange-800">{c.unread}</span>}</span><span className="mt-1 block truncate text-xs text-slate-500">{c.subject}</span><span className="mt-2 block truncate text-xs text-slate-500">{c.messages.at(-1)?.text || "Start the conversation"}</span></span></button>)}</div></aside>
      <section className="flex min-w-0 flex-col">{active ? <><header className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">{active.otherName}</h2><p className="muted text-xs">{active.subject}</p></header><div className="h-80 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5 md:max-h-[440px]" aria-label="Conversation messages" role="log" aria-live="polite">{active.messages.length === 0 && <p className="muted mt-10 text-center">Say hello to {active.otherName}.</p>}{active.messages.map(m => <div key={m.id} className={`flex ${m.senderId === userId ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.senderId === userId ? "rounded-br-sm bg-orange-600 text-white" : "rounded-bl-sm border border-slate-200 bg-white"}`}><p className="whitespace-pre-wrap break-words">{m.text}</p><p className={`mt-2 text-[10px] ${m.senderId === userId ? "text-orange-100" : "text-slate-400"}`}>{dateTime(m.createdAt)}</p></div></div>)}<div ref={end} /></div><form onSubmit={send} className="border-t border-slate-200 p-4">{error && <p className="error mb-3" role="alert">{error}</p>}<div className="flex items-end gap-2"><textarea className="field min-w-0" aria-label="Message" disabled={busy} rows={2} maxLength={3000} placeholder="Type your message…" value={text} onChange={e => setText(e.target.value)} required /><button className="btn" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send"}</button></div><p className="mt-2 text-xs text-slate-400">Messages refresh automatically while this page is open.</p></form></> : <div className="p-10 text-center"><p className="muted">Select a conversation to start messaging.</p></div>}</section>
    </div>}
  </>;
}


