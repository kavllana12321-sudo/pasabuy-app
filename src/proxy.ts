import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // An optimistic navigation check only. Every API request validates the session
  // against the local database and checks its user's permissions independently.
  if (!request.cookies.get("pasabuy_session")?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/customer/:path*", "/rider/:path*", "/admin/:path*",
  ],
};
