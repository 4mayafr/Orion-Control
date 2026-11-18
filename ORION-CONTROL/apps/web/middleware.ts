/**
 * Edge middleware.
 *
 * Fast gate only: verifies the signed session cookie and redirects. Real
 * authorisation (permissions, account status) happens again on the server for
 * every page and API route, because middleware cannot query the database
 * reliably on the edge.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/auth/session';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === '/login' || pathname === '/setup';

  if (!claims && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (claims && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login', '/setup'],
};
