import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

const PUBLIC_PATHS = ['/login'];

/**
 * First line of defence only: sends visitors without a session cookie to /login.
 * The cookie is NOT verified here. The backend verifies the JWT on every API call,
 * and AuthContext loads the real user from /api/auth/me.
 */
export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSessionCookie = request.cookies.has(AUTH_COOKIE_NAME);

  if (!isPublic && !hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};