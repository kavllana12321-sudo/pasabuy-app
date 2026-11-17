// Run against a running local app and headless Chrome with remote debugging enabled.
// No browser packages are needed: Node's WebSocket speaks Chrome DevTools Protocol.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const debugging = process.env.CHROME_DEBUG_URL || "http://127.0.0.1:9223";
const artifacts = join(process.cwd(), ".data", "test-artifacts");
const prefix = `browser-check-${randomUUID().slice(0, 8)}`;
const password = "BrowserTest123!";
const email = `${prefix}@example.test`;
const ids = [];
const checks = [];
const errors = [];
const admin = { cookie: "" };
await mkdir(artifacts, { recursive: true });
const tab = await (await fetch(`${debugging}/json/new?about:blank`, { method: "PUT", signal: AbortSignal.timeout(5000) })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Chrome WebSocket connection timed out")), 5000);
  ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let nextId = 0;
const pending = new Map();
ws.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id); clearTimeout(task.timer);
    if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
  else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map(value => value.value ?? value.description));
});
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitFor(expression, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { if (await evaluate(expression)) return; } catch (error) { if (!/context|navigat/i.test(error.message)) throw error; }
    await sleep(100);
  }
  throw new Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText")}`);
}
async function go(path) {
  const marker = randomUUID();
  await evaluate(`document.documentElement.dataset.browserNavigation = ${JSON.stringify(marker)}`);
  await command("Page.navigate", { url: base + path });
  await waitFor(`document.documentElement.dataset.browserNavigation !== ${JSON.stringify(marker)} && location.pathname + location.search === ${JSON.stringify(path)} && document.readyState === 'complete' && !!document.querySelector('h1')`);
  await sleep(300);
}
async function fill(selector, value) {
  await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing input: '+${JSON.stringify(selector)}); const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
async function clickText(text, selector = "button") {
  await evaluate(`(() => {const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(el=>el.innerText.trim()===${JSON.stringify(text)}); if(!el) throw new Error('Missing button: '+${JSON.stringify(text)}); if(el.disabled) throw new Error('Disabled button: '+${JSON.stringify(text)}); el.click();})()`);
}
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function submit(selector = "form") { await evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`); }
async function screenshot(name) { const { data } = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(join(artifacts, `${name}.png`), Buffer.from(data, "base64")); }
async function viewport(width = 390, height = 844) { await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 }); }
async function noOverflow(label) { const sizes = await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})"); assert.ok(sizes.scroll <= sizes.width, `${label}: horizontal overflow ${JSON.stringify(sizes)}`); }
async function logout() { await evaluate("fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})})"); }
async function snapshot() { return evaluate("fetch('/api/app').then(r=>r.json())"); }
async function login(address, secret, role = "customer") {
  await go("/login"); await fill("#email", address); await fill("#password", secret); await submit();
  const path = role === "customer" ? "/customer" : `/${role}`;
  await waitFor(`location.pathname===${JSON.stringify(path)} && !!document.querySelector('h1')`);
}
async function api(client, path, body) {
  const response = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", origin: base, ...(client.cookie ? { cookie: client.cookie } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data));
  if (response.headers.get("set-cookie")) client.cookie = response.headers.get("set-cookie").split(";")[0];
  return data;
}
function passed(label) { checks.push(label); console.log(`PASS ${label}`); }
await command("Page.enable"); await command("Runtime.enable");
try {
  await viewport(); await go("/"); await noOverflow("Home mobile"); await screenshot("home-mobile");
  await go("/login"); await noOverflow("Login mobile"); await screenshot("login-mobile");
  await clickText("Customer"); assert.equal(await evaluate("document.querySelector('#email').value"), "customer@pasabuy.local");
  await submit(); await waitFor("location.pathname==='/customer' && !!document.querySelector('h1')"); await noOverflow("Customer shell mobile"); await screenshot("customer-mobile"); passed("Home, login, and customer shell work at 390px without horizontal overflow");
  await logout(); await go("/register/customer");
  await fill("#name", "Browser QA Customer"); await fill("#email", email); await fill("#phone", "09123456789"); await fill("#password", password); await fill("#confirmPassword", password); await submit();
  await waitFor("document.body.innerText.includes('Save your recovery code')");
  ids.push((await snapshot()).user.id);
  const signupCode = await evaluate("document.querySelector('code').innerText"); assert.ok(signupCode.length > 10);
  assert.equal(await evaluate("document.querySelector('button.btn').disabled"), true);
  await click("input[type=checkbox]"); await clickText("Continue to dashboard →"); await waitFor("location.pathname==='/customer'"); passed("Signup creates account, shows recovery code, and requires acknowledgement");
  await go("/customer/marketplace"); await clickText("+ Sell an item"); await waitFor("!!document.querySelector('dialog[open]')");
  const title = `${prefix} banana bread`;
  await fill("dialog [name=title]", title); await fill("dialog [name=price]", "120"); await fill("dialog [name=description]", "Freshly baked browser QA listing."); await fill("dialog [name=location]", "Santa Cruz, Laguna"); await noOverflow("Marketplace modal mobile"); await screenshot("marketplace-modal-mobile"); await submit("dialog form");
  await waitFor("document.body.innerText.includes('Your listing is now published.')");
  await click(`button[aria-label="Like ${title}"]`); await waitFor(`document.querySelector(${JSON.stringify(`button[aria-label="Like ${title}"]`)}).getAttribute('aria-pressed')==='true'`);
  await clickText(title); await waitFor("!!document.querySelector('dialog[open]')"); await fill("[aria-label='Your comment']", "Is this still available?"); await clickText("Post"); await waitFor("document.body.innerText.includes('Is this still available?')");
  await clickText("Mark as sold"); await waitFor("document.querySelector('dialog').innerText.includes('Mark as available')"); await clickText("Mark as available"); await waitFor("document.querySelector('dialog').innerText.includes('Mark as sold')");
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await waitFor("!document.querySelector('dialog[open]')");
  await noOverflow("Marketplace mobile"); await screenshot("marketplace-mobile");
  await clickText(title); await waitFor("!!document.querySelector('dialog[open]')");
  const deleteClick = clickText("Delete listing"); await sleep(150); await command("Page.handleJavaScriptDialog", { accept: true }); await deleteClick; await waitFor(`!document.body.innerText.includes(${JSON.stringify(title)})`); passed("Marketplace publishes, likes, comments, toggles sold, closes with Escape, and deletes");
  await go("/customer/profile"); await fill("[name=address]", "Pagsanjan, Laguna"); await clickText("Save changes"); await waitFor("document.body.innerText.includes('Your profile has been saved.')");
  await go("/customer/profile"); assert.equal(await evaluate("document.querySelector('[name=address]').value"), "Pagsanjan, Laguna");
  await fill("form.max-w-xl [name=currentPassword]", password); await clickText("Generate new code"); await waitFor("!!document.querySelector('code')");
  const code = await evaluate("document.querySelector('code').innerText"); assert.notEqual(code, signupCode); await noOverflow("Profile mobile"); await screenshot("profile-mobile"); passed("Profile changes persist and authenticated recovery-code regeneration works");
  await logout(); await go("/forgot-password"); await fill("#email", email); await fill("#recoveryCode", code); await fill("#password", "BrowserChanged123!"); await fill("#confirmPassword", "BrowserChanged123!"); await submit(); await waitFor("document.body.innerText.includes('Password updated.')"); await login(email, "BrowserChanged123!"); passed("Recovery-code reset and login with the new password work");
  await go("/customer/create-post"); await fill("#title", `${prefix} groceries`); await fill("#details", "One kilo rice. Cash on delivery."); await fill("#pickup", "Santa Cruz Market"); await fill("#destination", "Pagsanjan Plaza"); await fill("#fee", "80"); await click("input[type=checkbox]"); await submit(); await waitFor("document.body.innerText.includes('Review your request')"); await clickText("Confirm & post request"); await waitFor("location.pathname==='/customer/tracking' && location.search.includes('id=')");
  const bookingId = await evaluate("new URLSearchParams(location.search).get('id')"); passed("Customer booking form reviews, posts, and opens tracking");
  const rider = { cookie: "" };
  const registration = await api(rider, "/api/auth", { action: "register", name: "Browser QA Rider", email: `${prefix}-rider@example.test`, phone: "09123456789", password, role: "rider", vehicle: "motorcycle", plate: "BROWSER-QA", serviceArea: "Laguna" }); ids.push(registration.user.id);
  await api(admin, "/api/auth", { action: "login", email: "admin@pasabuy.local", password: "PasaBuy123!" }); await api(admin, "/api/app", { action: "approveRider", id: registration.user.id, approved: true }); await api(rider, "/api/app", { action: "setAvailability", available: true });
  await api(rider, "/api/app", { action: "createListing", title: `${prefix} rider item`, description: "Second thread browser fixture", category: "Others", price: 100, location: "Laguna" });
  await logout(); await login(`${prefix}-rider@example.test`, password, "rider"); await fill("#job-search", `${prefix} groceries`); await clickText("Review request"); await clickText("Accept this request"); await waitFor("document.body.innerText.includes('Your current job')");
  await go(`/customer/tracking?id=${bookingId}`); await clickText("Message customer"); await waitFor("location.pathname==='/customer/messages' && !!document.querySelector('[aria-label=Message]')"); const bookingThread = await evaluate("new URLSearchParams(location.search).get('id')");
  await fill("[aria-label=Message]", "Hello customer, I accepted your request."); await clickText("Send"); await waitFor("document.querySelector('[role=log]').innerText.includes('Hello customer, I accepted your request.')");
  await go(`/customer/tracking?id=${bookingId}`); await clickText("Confirm pickup / start trip"); await waitFor("document.body.innerText.includes('Confirm delivery / complete trip')"); await clickText("Confirm delivery / complete trip"); await clickText("Yes, complete request"); await waitFor("!document.body.innerText.includes('Confirm delivery / complete trip')"); passed("Rider accepts, chats, confirms pickup, and completes booking through browser UI");
  await logout(); await login(email, "BrowserChanged123!"); await go(`/customer/tracking?id=${bookingId}`); assert.equal((await snapshot()).bookings.find(b => b.id === bookingId).status, "completed");
  await go("/customer/marketplace"); await clickText(`${prefix} rider item`); await waitFor("!!document.querySelector('dialog[open]')"); await clickText("Message seller"); await waitFor("location.pathname==='/customer/messages' && !!document.querySelector('[aria-label=Message]')");
  const listingThread = await evaluate("new URLSearchParams(location.search).get('id')"); assert.notEqual(bookingThread, listingThread); await fill("[aria-label=Message]", "Draft for the listing only");
  await evaluate(`(() => {const button=[...document.querySelectorAll('aside button')].find(el=>el.innerText.includes(${JSON.stringify(`${prefix} groceries`)})); if(!button) throw new Error('Missing booking thread'); button.click();})()`); await waitFor(`new URLSearchParams(location.search).get('id')===${JSON.stringify(bookingThread)}`); assert.equal(await evaluate("document.querySelector('[aria-label=Message]').value"), "");
  await evaluate(`(() => {const button=[...document.querySelectorAll('aside button')].find(el=>el.innerText.includes(${JSON.stringify(`${prefix} rider item`)})); if(!button) throw new Error('Missing listing thread'); button.click();})()`); await waitFor(`new URLSearchParams(location.search).get('id')===${JSON.stringify(listingThread)}`); assert.equal(await evaluate("document.querySelector('[aria-label=Message]').value"), "Draft for the listing only"); await noOverflow("Messages mobile"); await screenshot("messages-mobile"); passed("Customer sees completed status; message query navigation and per-thread drafts stay consistent");
  await viewport(1440, 1000); await go("/customer"); await noOverflow("Desktop dashboard"); await screenshot("customer-desktop");
  await logout(); await go("/login"); await clickText("Admin"); await submit(); await waitFor("location.pathname==='/admin' && !!document.querySelector('h1')"); passed("Admin demo login routes to administration");
  assert.deepEqual(errors, [], "Chrome runtime errors");
} catch (error) { process.exitCode = 1; console.error(error); try { await screenshot("failure"); } catch {} }
finally {
  await writeFile(join(artifacts, "browser-results.json"), JSON.stringify({ checks, errors }, null, 2));
  ws.close(); await fetch(`${debugging}/json/close/${tab.id}`, { signal: AbortSignal.timeout(5000) }).catch(() => {});
  const database = new DatabaseSync(join(process.env.PASABUY_DATA_DIR || join(process.cwd(), ".data"), "pasabuy.sqlite")); database.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE");
  try {
    // Only remove accounts created by THIS run, including a signup whose response was interrupted.
    const ownIds = new Set([...ids, ...database.prepare("SELECT id FROM users WHERE email = ? OR email = ? OR (email = ? AND json_extract(data,'$.name') = ?)").all(email, `${prefix}-rider@example.test`, "browser-1794529898155@pasabuy.local", "Browser QA Customer").map(row => row.id)]);
    for (const id of ownIds) {
      database.prepare("DELETE FROM sessions WHERE user_id=?").run(id); database.prepare("DELETE FROM bookings WHERE customer_id=? OR rider_id=?").run(id, id); database.prepare("DELETE FROM listings WHERE seller_id=?").run(id); database.prepare("DELETE FROM conversations WHERE participant_a=? OR participant_b=?").run(id, id); database.prepare("DELETE FROM notifications WHERE user_id=?").run(id); database.prepare("DELETE FROM users WHERE id=?").run(id);
    }
    const token = admin.cookie.split("=")[1]; if (token) database.prepare("DELETE FROM sessions WHERE token=?").run(createHash("sha256").update(token).digest("hex"));
    database.prepare("DELETE FROM attempts WHERE key LIKE ?").run(`%${prefix}%`); database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; } finally { database.close(); }
  console.log(JSON.stringify({ checks, errors }, null, 2));
}
