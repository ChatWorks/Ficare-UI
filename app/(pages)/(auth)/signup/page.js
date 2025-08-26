"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

function SignUpForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const supabase = createClientComponentClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const redirectedFrom = searchParams.get('redirectedFrom')

  // Check if user is already signed in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('User already signed in, redirecting...')
        router.push(redirectedFrom || '/dashboard')
      }
    }
    checkUser()
  }, [supabase, router, redirectedFrom])

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens zijn')
      setLoading(false)
      return
    }

    try {
      // Check if email is from allowed domains
      const allowedDomains = ['@ficare.nl', '@innoworks.ai']
      const isAllowedDomain = allowedDomains.some(domain => email.toLowerCase().endsWith(domain))
      
      if (!isAllowedDomain) {
        setError('Alleen @ficare.nl en @innoworks.ai email adressen zijn toegestaan.')
        setLoading(false)
        return
      }

      console.log('Starting direct signup process...')
      
      // Direct Supabase signup
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      
      console.log('Direct signup result:', { signUpData, signUpError })
      
      if (signUpError) {
        throw signUpError
      }
      
      // If signup successful, try to sign in immediately
      if (signUpData.user) {
        console.log('Signup successful, attempting auto-signin...')
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        
        console.log('Auto-signin result:', { signInData, signInError })
        
        if (signInError) {
          console.error('Auto-signin failed:', signInError)
          setMessage('Account aangemaakt! Je kunt nu inloggen.')
        } else if (signInData.session) {
          console.log('Auto-signin successful, redirecting...')
          router.push(redirectedFrom || '/dashboard')
        } else {
          setMessage('Account aangemaakt! Je kunt nu inloggen.')
        }
      } else {
        setMessage('Controleer je e-mail voor een bevestigingslink!')
      }
    } catch (error) {
      console.error('Direct signup error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#222c56]">
          Account aanmaken
        </h1>
        <p className="text-sm text-slate-600">
          Maak een Ficare account aan om te beginnen
        </p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="fullName" className="text-sm font-medium text-slate-700">
              Volledige naam
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-[#222c56] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors"
              placeholder="Voer je volledige naam in"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              E-mailadres
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-[#222c56] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors"
              placeholder="Voer je e-mailadres in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Wachtwoord
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-[#222c56] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors"
              placeholder="Maak een wachtwoord aan"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
              Bevestig wachtwoord
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-[#222c56] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors"
              placeholder="Bevestig je wachtwoord"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-[#e56e61]/10 border border-[#e56e61]/20 p-3">
            <div className="text-sm text-[#e56e61] font-medium">{error}</div>
          </div>
        )}

        {message && (
          <div className="rounded-lg bg-[#82cff4]/10 border border-[#82cff4]/20 p-3">
            <div className="text-sm text-[#222c56] font-medium">{message}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#222c56] hover:bg-[#222c56]/90 disabled:bg-[#222c56]/50 text-white font-medium py-2.5 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:ring-offset-2"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Account aanmaken...</span>
            </div>
          ) : (
            'Account aanmaken'
          )}
        </button>
      </form>

      <div className="text-center">
        <p className="text-sm text-slate-600">
          Al een account?{' '}
          <Link
            href="/signin"
            className="font-medium text-[#222c56] hover:text-[#82cff4] transition-colors"
          >
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  )
}

function SignUpPageFallback() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#222c56]">
          Account aanmaken
        </h1>
        <p className="text-sm text-slate-600">
          Maak een Ficare account aan om te beginnen
        </p>
      </div>
      <div className="flex justify-center">
        <div className="w-8 h-8 border-3 border-[#82cff4]/30 border-t-[#82cff4] rounded-full animate-spin"></div>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpPageFallback />}>
      <SignUpForm />
    </Suspense>
  )
}
