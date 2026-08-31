import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const isWorkspace = request.nextUrl.pathname.startsWith("/capture");
  const hasSession = Boolean(request.cookies.get("capture_session")?.value);
  if (isWorkspace && !hasSession) return NextResponse.redirect(new URL("/sign-in", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/capture/:path*"] };
