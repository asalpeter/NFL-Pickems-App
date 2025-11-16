import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = [/^\/dashboard$/, /^\/league\/.+/];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED.some((r) => r.test(path));
  if (!isProtected) return;

  const hasAccess = req.cookies.has("sb-access-token");
  if (!hasAccess) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/dashboard", "/league/:path*"],
};
