import { all, get, run, transact, setSqliteProvider } from "./storage";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Booking, Conversation, Listing, Notification, Role, Snapshot, User } from "../types";
import { dataDirectory, demoEnabled } from "./config";
export class AppError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function passwordHash(password: string) {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, encoded: string) {
    const [salt, digest] = encoded.split(":");
    if (!salt || !digest)
        return false;
    const expected = Buffer.from(digest, "hex");
    const actual = scryptSync(password, salt, 64);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const databaseGlobal = globalThis as unknown as {
    pasabuyDatabase?: DatabaseSync;
};
function db() {
    if (databaseGlobal.pasabuyDatabase)
        return databaseGlobal.pasabuyDatabase;
    const dir = dataDirectory();
    mkdirSync(dir, { recursive: true });
    const database = new DatabaseSync(join(dir, "pasabuy.sqlite"));
    database.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, recovery TEXT, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, rider_id TEXT, status TEXT NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS bookings_customer ON bookings(customer_id);
    CREATE INDEX IF NOT EXISTS bookings_rider ON bookings(rider_id);
    CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, participant_a TEXT NOT NULL, participant_b TEXT NOT NULL, context TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(participant_a, participant_b, context));
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id);
    CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
  `);
    databaseGlobal.pasabuyDatabase = database;
    // Seed accounts are local test accounts. No fabricated activity is inserted.
    for (const role of (demoEnabled() ? ["customer", "rider", "admin"] : []) as Role[]) {
        const email = `${role}@pasabuy.local`;
        if (!database.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
            const user: User = { id: randomUUID(), name: role === "customer" ? "Demo Customer" : role === "rider" ? "Demo Rider" : "Administrator", email, phone: "09171234567", address: "Santa Cruz, Laguna", role, vehicle: role === "rider" ? "Motorcycle" : "", plate: role === "rider" ? "DEMO-001" : "", serviceArea: role === "rider" ? "Laguna" : "", approved: true, available: true, createdAt: new Date().toISOString() };
            database.prepare("INSERT OR IGNORE INTO users(id,email,password,recovery,data) VALUES(?,?,?,?,?)").run(user.id, email, passwordHash("PasaBuy123!"), null, JSON.stringify(user));
        }
    }
    return database;
}
export const transaction = transact;
export function parsed<T>(row: Record<string, unknown> | undefined): T | null {
    return row ? JSON.parse(String(row.data)) as T : null;
}
export async function userById(id: string) { return parsed<User>(await get("SELECT data FROM users WHERE id = ?", id)); }
export async function saveUser(user: User) { await run("UPDATE users SET email = ?, data = ? WHERE id = ?", user.email, JSON.stringify(user), user.id); }
export async function bookingById(id: string) { return parsed<Booking>(await get("SELECT data FROM bookings WHERE id = ?", id)); }
export async function saveBooking(booking: Booking) { await run("UPDATE bookings SET rider_id = ?, status = ?, data = ? WHERE id = ?", booking.riderId, booking.status, JSON.stringify(booking), booking.id); }
export async function listingById(id: string) { return parsed<Listing>(await get("SELECT data FROM listings WHERE id = ?", id)); }
export async function saveListing(listing: Listing) { await run("UPDATE listings SET data = ? WHERE id = ?", JSON.stringify(listing), listing.id); }
export type StoredConversation = {
    id: string;
    participantA: string;
    participantB: string;
    bookingId: string | null;
    listingId: string | null;
    subject: string;
    readAt: Record<string, string>;
    messages: Conversation["messages"];
};
export async function conversationById(id: string) { return parsed<StoredConversation>(await get("SELECT data FROM conversations WHERE id = ?", id)); }
export async function saveConversation(conversation: StoredConversation) { await run("UPDATE conversations SET data = ? WHERE id = ?", JSON.stringify(conversation), conversation.id); }
export async function notify(userId: string, title: string, text: string, href: string) {
    const notification: Notification = { id: randomUUID(), title, text, href, read: false, createdAt: new Date().toISOString() };
    await run("INSERT INTO notifications(id,user_id,data) VALUES(?,?,?)", notification.id, userId, JSON.stringify(notification));
}
export async function createConversation(a: string, b: string, context: string, bookingId: string | null, listingId: string | null, subject: string) {
    if (a === b)
        throw new AppError("You cannot start a conversation with yourself.");
    const [participantA, participantB] = [a, b].sort();
    const existing = parsed<StoredConversation>(await get("SELECT data FROM conversations WHERE participant_a = ? AND participant_b = ? AND context = ?", participantA, participantB, context));
    if (existing)
        return existing.id;
    const conversation: StoredConversation = { id: randomUUID(), participantA, participantB, bookingId, listingId, subject, readAt: {}, messages: [] };
    await run("INSERT INTO conversations(id,participant_a,participant_b,context,data) VALUES(?,?,?,?,?)", conversation.id, participantA, participantB, context, JSON.stringify(conversation));
    return conversation.id;
}
setSqliteProvider(db);
export async function snapshot(user: User): Promise<Snapshot> {
  const members = (await all("SELECT data FROM users")).map(row => parsed<User>(row)!);
  const names = new Map(members.map(member => [member.id, member.name]));
  const bookings = (await all("SELECT data FROM bookings ORDER BY rowid DESC")).map(row => parsed<Booking>(row)!)
    .filter(booking => user.role === 'admin' || booking.customerId === user.id || (user.role === 'rider' && (booking.riderId === user.id || (user.approved && booking.status === 'pending'))))
    .map(booking => {
      const permitted = user.role === 'admin' || booking.customerId === user.id || booking.riderId === user.id;
      return { ...booking, customerName: names.get(booking.customerId) || booking.customerName, riderName: booking.riderId ? names.get(booking.riderId) || booking.riderName : null, phone: permitted ? booking.phone : '', latitude: permitted ? booking.latitude : null, longitude: permitted ? booking.longitude : null };
    });
  const listings = (await all("SELECT data FROM listings ORDER BY rowid DESC")).map(row => parsed<Listing>(row)!).map(listing => ({ ...listing, sellerName: names.get(listing.sellerId) || listing.sellerName, comments: listing.comments.map(comment => ({ ...comment, name: names.get(comment.userId) || comment.name })) }));
  const conversations = (await all("SELECT data FROM conversations WHERE participant_a = ? OR participant_b = ? ORDER BY rowid DESC", user.id, user.id)).map(row => {
    const conversation = parsed<StoredConversation>(row)!;
    const otherId = conversation.participantA === user.id ? conversation.participantB : conversation.participantA;
    return { id: conversation.id, otherId, otherName: names.get(otherId) || 'Member', bookingId: conversation.bookingId, listingId: conversation.listingId, subject: conversation.subject, messages: conversation.messages, unread: conversation.messages.filter(message => message.senderId !== user.id && message.createdAt > (conversation.readAt[user.id] || '')).length };
  }).sort((a, b) => (b.messages.at(-1)?.createdAt || '').localeCompare(a.messages.at(-1)?.createdAt || ''));
  const notifications = (await all("SELECT data FROM notifications WHERE user_id = ? ORDER BY rowid DESC LIMIT 200", user.id)).map(row => parsed<Notification>(row)!);
  return { user, bookings, listings, conversations, notifications, users: user.role === 'admin' ? members : [] };
}
