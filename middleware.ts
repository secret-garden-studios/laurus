import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api')) {
    // 1. Extract the path after '/api' (e.g., '/login')
    const path = request.nextUrl.pathname.replace(/^\/api/, '');
    
    // 2. Build the exact AWS URL including the stage '/prod'
    // Ensure no double slashes: if path is '/login', it becomes .../prod/login
    const awsUrl = `https://amazonaws.com${path}`;
    
    const url = new URL(awsUrl);
    // Add any existing query parameters
    url.search = request.nextUrl.search;

    const requestHeaders = new Headers(request.headers);
    
    // 3. CRITICAL: AWS API Gateway often rejects requests if 'host' isn't its own URL.
    requestHeaders.set('host', 'j9w1qh5b65.execute-api.us-east-2.amazonaws.com');

    // 4. Perform the rewrite
    return NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  }
}

export const config = {
  matcher: '/api/:path*',
};
