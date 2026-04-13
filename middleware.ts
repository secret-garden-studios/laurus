import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the request is for our proxied API
  if (request.nextUrl.pathname.startsWith('/api')) {
    // 1. Construct the new URL
    const targetPath = request.nextUrl.pathname.replace(/^\/api/, '');
    const searchParams = request.nextUrl.search;
    const destination = `https://amazonaws.com${targetPath}${searchParams}`;

    // 2. Clone headers and set the correct Host for AWS
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('host', 'j9w1qh5b65.execute-api.us-east-2.amazonaws.com');

    // 3. Rewrite to the destination with corrected headers
    return NextResponse.rewrite(new URL(destination), {
      request: {
        headers: requestHeaders,
      },
    });
  }
}

// Ensure middleware only runs for /api routes to save performance
export const config = {
  matcher: '/api/:path*',
};
