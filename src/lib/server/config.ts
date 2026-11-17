import { isAbsolute, join } from "node:path";

export const demoEnabled = () => process.env.PASABUY_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
export const demoEmail = (email: string) => ["customer@pasabuy.local", "rider@pasabuy.local", "admin@pasabuy.local"].includes(email.toLowerCase());
export function dataDirectory() {
  const directory = process.env.PASABUY_DATA_DIR || join(process.cwd(), ".data");
  if (process.env.NODE_ENV === "production" && !process.env.PASABUY_DATA_DIR) throw new Error("Set PASABUY_DATA_DIR to a persistent absolute directory before starting production.");
  if (!isAbsolute(directory)) throw new Error("PASABUY_DATA_DIR must be absolute.");
  return directory;
}
export function applicationOrigin(request: Request) {
  if (process.env.APP_ORIGIN) return new URL(process.env.APP_ORIGIN).origin;
  if (process.env.NODE_ENV === "production") throw new Error("APP_ORIGIN is required in production.");
  return new URL(request.url).origin;
}
