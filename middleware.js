import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  // Create a response object that we'll modify
  const res = NextResponse.next()

  // Create the Supabase client
  const supabase = createMiddlewareClient({ req, res })

  try {
    // Refresh the session
    const sessionResponse = await supabase.auth.getSession()
    const session = sessionResponse.data.session
    
    // Define public routes that don't require authentication
    const publicRoutes = ['/signin', '/signup', '/reset-password', '/update-password', '/signout', '/auth/callback']
    const currentPath = req.nextUrl.pathname

    // Check if session is valid
    const isSessionValid = session && 
      session.access_token && 
      session.expires_at && 
      new Date(session.expires_at * 1000) > new Date()


    // If session is valid, always let the request through
    if (isSessionValid) {
      return res
    }

    // If no valid session and trying to access protected routes
    if (!publicRoutes.includes(currentPath) && currentPath !== '/') {
      const redirectUrl = new URL('/signin', req.url)
      // Add the original URL as a redirectedFrom parameter
      // redirectUrl.searchParams.set('redirectedFrom', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    return res
  } catch (error) {
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (completely excluded)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
} 