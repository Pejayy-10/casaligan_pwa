import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // For database-based auth, we can't check localStorage in middleware
  // So we'll let all requests through and handle auth on the client side
  // The login page will redirect to dashboard if authenticated
  // Protected pages will check auth in their components
  
  const { pathname } = request.nextUrl;
  
  // Allow access to auth page
  if (pathname === '/auth') {
    return NextResponse.next();
  }
  
  // For other pages, continue (client-side will handle auth check)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

