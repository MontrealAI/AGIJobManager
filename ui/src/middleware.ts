import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const development = process.env.NODE_ENV === 'development';
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https:",
    `connect-src 'self' https: wss:${development ? ' http: ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
  const headers = new Headers(request.headers);
  // Overwrite client-supplied values; Next applies this nonce to its own scripts.
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)']
};
