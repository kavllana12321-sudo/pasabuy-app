import { get } from "./storage";
import { NextResponse } from "next/server";
import { AppError, hash, userById } from "./database";
import { applicationOrigin, demoEmail, demoEnabled } from "./config";
export const SESSION_COOKIE = "pasabuy_session";
export function tokenFrom(request: Request) {
    const pair = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
    return pair ? pair.slice(SESSION_COOKIE.length + 1) : "";
}
export async function currentUser(request: Request) {
    const token = tokenFrom(request);
    if (!token)
        return null;
    const row = await get("SELECT user_id FROM sessions WHERE token = ? AND expires > ?", hash(token), Date.now());
    const user = row ? await userById(String(row.user_id)) : null;
    return user && (!demoEmail(user.email) || demoEnabled()) ? user : null;
}
export async function requireUser(request: Request) {
    const user = await currentUser(request);
    if (!user)
        throw new AppError("Please log in to continue.", 401);
    return user;
}
export function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
export function failure(error: unknown) {
    if (error instanceof AppError)
        return json({ error: error.message }, error.status);
    console.error("PasaBuy request failed:", error);
    return json({ error: "Unable to complete this request. Please try again." }, 500);
}
export async function body(request: Request): Promise<Record<string, unknown>> {
    const origin = request.headers.get("origin");
    if (origin && origin !== applicationOrigin(request))
        throw new AppError("This request must come from this website.", 403);
    if (request.headers.get("sec-fetch-site") === "cross-site")
        throw new AppError("Cross-site requests are not allowed.", 403);
    if (!request.headers.get("content-type")?.includes("application/json"))
        throw new AppError("Send a JSON request.", 415);
    if (Number(request.headers.get("content-length") || 0) > 50000)
        throw new AppError("Request is too large.", 413);
    const reader = request.body?.getReader();
    if (!reader)
        throw new AppError("Invalid request.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            bytes += value.byteLength;
            if (bytes > 50000) {
                await reader.cancel();
                throw new AppError("Request is too large.", 413);
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let data: unknown;
    try {
        data = JSON.parse(raw);
    }
    catch {
        throw new AppError("Invalid JSON request.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
        throw new AppError("Invalid request.");
    return data as Record<string, unknown>;
}
export function text(data: Record<string, unknown>, key: string, min = 1, max = 200): string {
    const value = data[key];
    if (typeof value !== "string") {
        if (min === 0 && value === undefined)
            return "";
        throw new AppError(`${key} is required.`);
    }
    const clean = value.trim();
    if (clean.length < min || clean.length > max)
        throw new AppError(`${key} must contain ${min}–${max} characters.`);
    return clean;
}
export function phone(data: Record<string, unknown>) {
    const value = text(data, "phone", 7, 20).replace(/[ ()-]/g, "");
    if (!/^(09\d{9}|\+639\d{9})$/.test(value))
        throw new AppError("Enter a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX.");
    return value;
}
export function password(data: Record<string, unknown>, key = "password") {
    const value = data[key];
    if (typeof value !== "string" || value.length < 8 || value.length > 128)
        throw new AppError("Password must contain 8–128 characters.");
    return value;
}
export function numeric(data: Record<string, unknown>, key: string, min: number, max: number) {
    const value = data[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
        throw new AppError(`${key} must be between ${min} and ${max}.`);
    return value;
}
export function boolean(data: Record<string, unknown>, key: string) {
    if (typeof data[key] !== "boolean")
        throw new AppError(`${key} must be true or false.`);
    return data[key] as boolean;
}
