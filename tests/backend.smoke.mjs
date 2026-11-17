import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import test from "node:test";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const prefix = `check-${randomUUID().slice(0, 8)}`;
const password = "SmokeTest123!";
const ids = [];
class Client {
  cookie = "";
  async request(path, data, expected = 200) {
    const response = await fetch(`${base}${path}`, { method: data ? "POST" : "GET", headers: { ...(data ? { "content-type": "application/json", origin: base } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const body = await response.json();
    assert.equal(response.status, expected, `${path} ${data?.action || "GET"}: ${JSON.stringify(body)}`);
    if (response.headers.get("set-cookie")) this.cookie = response.headers.get("set-cookie").split(";")[0];
    return body;
  }
  action(action, data = {}, expected = 200) { return this.request("/api/app", { action, ...data }, expected); }
  snapshot() { return this.request("/api/app"); }
  async register(role, suffix = role, vehicle = "motorcycle") {
    const result = await this.request("/api/auth", { action: "register", name: `Check ${suffix}`, email: `${prefix}-${suffix}@example.test`, phone: "09171234567", password, role, vehicle, plate: "CHECK-01", serviceArea: "Laguna" });
    ids.push(result.user.id);
    assert.ok(result.recoveryCode);
    return result;
  }
}
test("local modules persist, enforce roles, and complete customer-to-rider lifecycle", async () => {
  const customer = new Client(), outsider = new Client(), rider = new Client(), secondRider = new Client(), admin = new Client();
  try {
    await customer.request("/api/app", undefined, 401);
    await customer.request("/api/auth", { action: "login", email: `${prefix}@example.test`, password }, 401);
    const registration = await customer.register("customer");
    const customerId = registration.user.id;
    await outsider.register("customer", "outsider");
    const riderRegistration = await rider.register("rider");
    const riderId = riderRegistration.user.id;
    await rider.action("setAvailability", { available: true }, 403);
    await admin.request("/api/auth", { action: "login", email: "admin@pasabuy.local", password: "PasaBuy123!" });
    await customer.action("approveRider", { id: riderId, approved: true }, 403);
    await admin.action("approveRider", { id: riderId, approved: true });
    await rider.action("setAvailability", { available: true });
    const riderProfile = { name: "Updated Rider", phone: "09171234567", address: "Laguna", vehicle: "Motorcycle", plate: "CHECK-01", serviceArea: "Laguna" };
    await rider.action("updateProfile", riderProfile);
    assert.equal((await rider.snapshot()).user.approved, true, "Case-only vehicle changes must preserve approval");
    assert.equal((await rider.snapshot()).user.available, true);
    const request = { service: "pasabuy", title: "Smoke check groceries", details: "One kilo rice, cash payment", pickup: "Santa Cruz Market", destination: "Pagsanjan Plaza", phone: "09171234567", fee: 60, latitude: 14.27, longitude: 121.45 };
    await customer.action("createBooking", { ...request, fee: -1 }, 400);
    const { id: bookingId } = await customer.action("createBooking", request);
    assert.ok((await customer.snapshot()).bookings.some(booking => booking.id === bookingId));
    const visible = (await rider.snapshot()).bookings.find(booking => booking.id === bookingId);
    assert.equal(visible.phone, "");
    assert.equal(visible.latitude, null);
    assert.equal((await outsider.snapshot()).bookings.length, 0);
    await outsider.action("cancelBooking", { id: bookingId }, 403);
    await customer.action("acceptBooking", { id: bookingId }, 403);
    await rider.action("acceptBooking", { id: bookingId });
    await rider.action("updateProfile", { ...riderProfile, plate: "NEW-02" }, 409);
    await rider.action("updateProfile", { ...riderProfile, name: "Updated Rider Contact", phone: "+639171234567" });
    assert.equal((await rider.snapshot()).user.approved, true, "Ordinary contact updates must preserve approval during an active job");
    assert.equal((await rider.snapshot()).user.plate, "CHECK-01", "A rejected credential edit must not change saved credentials");
    await rider.action("acceptBooking", { id: bookingId }, 409);
    await customer.action("cancelBooking", { id: bookingId }, 409);
    const { id: secondId } = await customer.action("createBooking", { ...request, title: "Second pending job" });
    await rider.action("acceptBooking", { id: secondId }, 409);
    await admin.action("approveRider", { id: riderId, approved: false }, 409);
    const conversation = (await customer.snapshot()).conversations.find(item => item.bookingId === bookingId);
    assert.ok(conversation);
    await customer.action("sendMessage", { id: conversation.id, text: "Hello rider" });
    await outsider.action("sendMessage", { id: conversation.id, text: "Unauthorized" }, 403);
    assert.equal((await rider.snapshot()).conversations.find(item => item.id === conversation.id).unread, 1);
    await rider.action("readConversation", { id: conversation.id });
    assert.equal((await rider.snapshot()).conversations.find(item => item.id === conversation.id).unread, 0);
    await rider.action("sendMessage", { id: conversation.id, text: "On my way" });
    assert.equal((await customer.snapshot()).conversations.find(item => item.id === conversation.id).messages.length, 2);
    await rider.action("advanceBooking", { id: bookingId });
    await rider.action("advanceBooking", { id: bookingId });
    const completed = (await customer.snapshot()).bookings.find(booking => booking.id === bookingId);
    assert.equal(completed.status, "completed");
    assert.deepEqual(completed.history.map(item => item.status), ["pending", "accepted", "picked_up", "completed"]);
    await rider.action("advanceBooking", { id: bookingId }, 409);
    await rider.action("updateProfile", { ...riderProfile, serviceArea: "Santa Cruz, Laguna" });
    assert.equal((await rider.snapshot()).user.approved, false);
    assert.equal((await rider.snapshot()).user.available, false);
    await rider.action("setAvailability", { available: true }, 403);
    await admin.action("approveRider", { id: riderId, approved: true });
    await rider.action("setAvailability", { available: true });
    await customer.action("cancelBooking", { id: secondId });
    const secondRiderRegistration = await secondRider.register("rider", "second-rider", "bicycle");
    assert.equal(secondRiderRegistration.user.plate, "CHECK-01", "Bicycle IDs supplied at registration must be saved");
    await admin.action("approveRider", { id: secondRiderRegistration.user.id, approved: true });
    await secondRider.action("setAvailability", { available: true });
    const { id: angkasId } = await customer.action("createBooking", { ...request, service: "angkas" });
    await secondRider.action("acceptBooking", { id: angkasId }, 403);
    await customer.action("cancelBooking", { id: angkasId });
    const { id: raceId } = await customer.action("createBooking", { ...request, title: "Concurrent request claim" });
    const results = await Promise.all([rider, secondRider].map(async client => {
      const response = await fetch(`${base}/api/app`, { method: "POST", headers: { "content-type": "application/json", cookie: client.cookie, origin: base }, body: JSON.stringify({ action: "acceptBooking", id: raceId }) });
      return response.status;
    }));
    assert.deepEqual(results.sort(), [200, 409]);
    const { id: listingId } = await customer.action("createListing", { title: "Smoke check rice", description: "Unopened test listing", category: "Groceries", price: 70, location: "Santa Cruz" });
    await outsider.action("likeListing", { id: listingId });
    await outsider.action("commentListing", { id: listingId, text: "Available?" });
    await outsider.action("deleteListing", { id: listingId }, 403);
    const { id: listingConversationId } = await outsider.action("startConversation", { listingId });
    await outsider.action("sendMessage", { id: listingConversationId, text: "Interested in this item" });
    assert.equal((await customer.snapshot()).conversations.find(item => item.id === listingConversationId).messages.length, 1);
    const savedListing = (await customer.snapshot()).listings.find(item => item.id === listingId);
    assert.equal(savedListing.likes.length, 1);
    assert.equal(savedListing.comments.length, 1);
    await customer.action("toggleListingSold", { id: listingId });
    await rider.action("startConversation", { listingId }, 409);
    await customer.action("deleteListing", { id: listingId });
    await customer.action("updateProfile", { name: "Updated Customer", phone: "09171234567", address: "Laguna" });
    assert.equal((await customer.snapshot()).user.name, "Updated Customer");
    await customer.action("readNotifications");
    assert.ok((await customer.snapshot()).notifications.every(item => item.read));
    await customer.action("changePassword", { currentPassword: "Incorrect123!", password: "Updated123!" }, 403);
    await customer.action("changePassword", { currentPassword: password, password: "Updated123!" });
    const { recoveryCode } = await customer.action("regenerateRecovery", { currentPassword: "Updated123!" });
    await customer.request("/api/auth", { action: "reset", email: registration.user.email, recoveryCode, password: "Reset123!" });
    await customer.request("/api/app", undefined, 401);
    await customer.request("/api/auth", { action: "reset", email: registration.user.email, recoveryCode, password: "Again123!" }, 401);
    await customer.request("/api/auth", { action: "login", email: registration.user.email, password: "Reset123!" });
    assert.equal((await customer.snapshot()).user.id, customerId);
    await customer.request("/api/auth", { action: "logout" });
    await customer.request("/api/app", undefined, 401);
  } finally {
    const database = new DatabaseSync(join(process.env.PASABUY_DATA_DIR || join(process.cwd(), ".data"), "pasabuy.sqlite"));
    database.exec("PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE");
    try {
      for (const id of ids) {
        database.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
        database.prepare("DELETE FROM bookings WHERE customer_id = ? OR rider_id = ?").run(id, id);
        database.prepare("DELETE FROM listings WHERE seller_id = ?").run(id);
        database.prepare("DELETE FROM conversations WHERE participant_a = ? OR participant_b = ?").run(id, id);
        database.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
        database.prepare("DELETE FROM users WHERE id = ?").run(id);
      }
      const adminToken = admin.cookie.split("=")[1];
      if (adminToken) database.prepare("DELETE FROM sessions WHERE token = ?").run(createHash("sha256").update(adminToken).digest("hex"));
      database.prepare("DELETE FROM attempts WHERE key LIKE ?").run(`%${prefix}%`);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    database.close();
  }
});
