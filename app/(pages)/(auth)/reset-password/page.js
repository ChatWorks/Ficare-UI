"use client"

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { resetPassword } = useAuth()

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      await resetPassword(email)
      setMessage('Controleer je e-mail voor een wachtwoord resetlink!')
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#222c56]">
          Wachtwoord resetten
        </h1>
        <p className="text-sm text-slate-600">
          Voer je e-mailadres in en we sturen je een resetlink
        </p>
      </div>
      
      <form onSubmit={handleResetPassword} className="space-y-4">
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
              <span>Link versturen...</span>
            </div>
          ) : (
            'Resetlink versturen'
          )}
        </button>
      </form>

      <div className="text-center">
        <Link
          href="/signin"
          className="text-sm font-medium text-[#222c56] hover:text-[#82cff4] transition-colors"
        >
          Terug naar inloggen
        </Link>
      </div>
    </div>
  )
}
