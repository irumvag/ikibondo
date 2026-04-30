import { NextRequest, NextResponse } from 'next/server';

// Routes anyone can visit without a session
const PUBLIC_PATHS = ['/', '/about', '/login', '/register'];

// Where each role lands after login
const ROLE_HOME: Record<string, string> = {
  ADMIN:      '/admin',
  SUPERVISOR: '/supervisor',
  NURSE:      '/nurse',
  CHW:        '/chw',
  PARENT:     '/parent',
};

// Prefixes a role is allowed to visit (their own + public)
const ROLE_PREFIX: Record<string, string> = {
  ADMIN:      '/admin',
  SUPERVISOR: '/supervisor',
  NURSE:      '/nurse',
  CHW:        '/chw',
  PARENT:     '/parent',
};

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next internals + static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Role stored as a plain (non-sensitive) cookie set on login
  const role = request.cookies.get('_ikibondo_role')?.value;

  // Unauthenticated user hitting a protected route → login
  if (!role && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting login/register → their home dashboard
  if (role && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = ROLE_HOME[role] ?? '/';
    return NextResponse.redirect(url);
  }

  // Authenticated user trying to access another role's routes → their home
  if (role && !isPublic(pathname)) {
    const allowed = ROLE_PREFIX[role];
    if (allowed && !pathname.startsWith(allowed)) {
      const url = request.nextUrl.clone();
      url.pathname = ROLE_HOME[role] ?? '/';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
