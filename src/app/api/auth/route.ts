import { get, run } from "@/lib/server/storage";
import { randomBytes, randomUUID } from "node:crypto";
import { AppError, hash, notify, parsed, passwordHash, passwordMatches, transaction } from "@/lib/server/database";
import { body, currentUser, failure, json, password, phone, SESSION_COOKIE, text, tokenFrom } from "@/lib/server/http";
import type { Role, User } from "@/lib/types";
import { applicationOrigin, demoEmail, demoEnabled } from "@/lib/server/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function emailFrom(data: Record<string, unknown>) {
    const email = text(data, "email", 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new AppError("Enter a valid email address.");
    return email;
}
async function throttle(email: string, action: string) {
    const key = `${action}:${email}`;
    const row = await get("SELECT count,expires FROM attempts WHERE key = ?", key);
    if (row && Number(row.expires) > Date.now() && Number(row.count) >= 12)
        throw new AppError("Too many attempts. Please try again in 15 minutes.", 429);
    if (!row || Number(row.expires) <= Date.now())
        await run("INSERT INTO attempts(key,count,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, expires = excluded.expires", key, 1, Date.now() + 15 * 60 * 1000);
    else
        await run("UPDATE attempts SET count = count + 1 WHERE key = ?", key);
}
async function signedIn(request: Request, user: User, remember: boolean, extra: Record<string, unknown> = {}) {
    const token = randomBytes(32).toString("hex");
    const seconds = (remember ? 30 : 1) * 24 * 60 * 60;
    await run("DELETE FROM sessions WHERE expires <= ?", Date.now());
    await run("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)", hash(token), user.id, Date.now() + seconds * 1000);
    const oldToken = tokenFrom(request);
    if (oldToken)
        await run("DELETE FROM sessions WHERE token = ?", hash(oldToken));
    const response = json({ user, ...extra });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: applicationOrigin(request).startsWith("https:"), path: "/", ...(remember ? { maxAge: seconds } : {}) });
    return response;
}
export async function GET(request: Request) {
    try {
        return json({ user: await currentUser(request), demoEnabled: demoEnabled() });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request: Request) {
    try {
        const data = await body(request);
        const action = text(data, "action");
        // Only trust this header when an operator controls the reverse proxy.
        if (process.env.PASABUY_TRUST_PROXY === "true") {
            const ip = request.headers.get("x-real-ip");
            if (!ip)
                throw new AppError("Proxy client address is missing.", 503);
            await throttle(`client-${hash(ip)}`, "auth");
        }
        if (action === "logout") {
            const token = tokenFrom(request);
            if (token)
                await run("DELETE FROM sessions WHERE token = ?", hash(token));
            const response = json({ ok: true });
            response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
            return response;
        }
        const email = emailFrom(data);
        if (demoEmail(email) && !demoEnabled())
            throw new AppError("Email or password is incorrect.", 401);
        if (action === "login") {
            await throttle(email, "login");
            const secret = password(data);
            const row = await get("SELECT * FROM users WHERE email = ?", email);
            if (!row || !passwordMatches(secret, String(row.password)))
                throw new AppError("Email or password is incorrect.", 401);
            await run("DELETE FROM attempts WHERE key = ?", `login:${email}`);
            return await signedIn(request, parsed<User>(row)!, data.remember === true);
        }
        if (action === "register") {
            const name = text(data, "name", 2, 100);
            const contact = phone(data);
            const secret = password(data);
            const role = text(data, "role") as Role;
            if (role !== "customer" && role !== "rider")
                throw new AppError("Select a customer or rider account.");
            const vehicle = role === "rider" ? text(data, "vehicle", 2, 100).toLowerCase() : "";
            if (role === "rider" && !["motorcycle", "bicycle", "car"].includes(vehicle))
                throw new AppError("Choose a motorcycle, bicycle, or car.");
            const plate = role === "rider" ? text(data, "plate", vehicle === "bicycle" ? 0 : 2, 30) : "";
            const serviceArea = role === "rider" ? text(data, "serviceArea", 2, 150) : "";
            const recoveryCode = randomBytes(16).toString("hex").match(/.{4}/g)!.join("-");
            const user = await transaction(async () => {
                if (await get("SELECT id FROM users WHERE email = ?", email))
                    throw new AppError("This email already has an account.", 409);
                const user: User = { id: randomUUID(), name, email, phone: contact, address: "", role, vehicle, plate, serviceArea, approved: role === "customer", available: false, createdAt: new Date().toISOString() };
                await run("INSERT INTO users(id,email,password,recovery,data) VALUES(?,?,?,?,?)", user.id, email, passwordHash(secret), hash(recoveryCode.replace(/-/g, "")), JSON.stringify(user));
                await notify(user.id, "Welcome to PasaBuy", role === "rider" ? "Your rider account is awaiting administrator approval." : "Your account is ready. You can create your first request.", role === "rider" ? "/rider" : "/customer");
                return user;
            });
            return await signedIn(request, user, false, { recoveryCode });
        }
        if (action === "reset") {
            await throttle(email, "reset");
            const code = text(data, "recoveryCode", 10, 100).replace(/-/g, "").toLowerCase();
            const secret = password(data);
            await transaction(async () => {
                const row = await get("SELECT * FROM users WHERE email = ?", email);
                if (!row || !row.recovery || hash(code) !== row.recovery)
                    throw new AppError("Email or recovery code is incorrect.", 401);
                await run("UPDATE users SET password = ?, recovery = NULL WHERE id = ?", passwordHash(secret), String(row.id));
                await run("DELETE FROM sessions WHERE user_id = ?", String(row.id));
                await run("DELETE FROM attempts WHERE key = ?", `reset:${email}`);
            });
            return json({ ok: true });
        }
        throw new AppError("Unknown authentication action.");
    }
    catch (error) {
        return failure(error);
    }
}
