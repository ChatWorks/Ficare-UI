"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const router = useRouter()
  const supabase = createClientComponentClient()



  const handleSignIn = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('Starting direct signin process...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      console.log('Direct signin result:', { data, error })
      
      if (error) {
        throw error
      }
      
      if (data.session) {
        console.log('Signin successful, session created:', data.session)
        setUser(data.user)
        // Use router.push for consistent navigation
        router.push('/dashboard')
      } else {
        throw new Error('No session created')
      }
    } catch (error) {
      console.error('Direct signin error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#222c56]">
          Welkom terug
        </h1>
        <p className="text-sm text-slate-600">
          Log in op je account om door te gaan
        </p>
      </div>
      
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-3">
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
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-[#222c56] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors"
              placeholder="Voer je wachtwoord in"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Link
            href="/reset-password"
            className="text-sm font-medium text-[#222c56] hover:text-[#82cff4] transition-colors"
          >
            Wachtwoord vergeten?
          </Link>
        </div>

        {error && (
          <div className="rounded-lg bg-[#e56e61]/10 border border-[#e56e61]/20 p-3">
            <div className="text-sm text-[#e56e61] font-medium">{error}</div>
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
              <span>Inloggen...</span>
            </div>
          ) : (
            'Inloggen'
          )}
        </button>
      </form>

      <div className="text-center">
        <p className="text-sm text-slate-600">
          Nog geen account?{' '}
          <Link
            href="/signup"
            className="font-medium text-[#222c56] hover:text-[#82cff4] transition-colors"
          >
            Registreren
          </Link>
        </p>
      </div>
    </div>
  )
}
