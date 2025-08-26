"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { updatePassword, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated
    if (!user) {
      router.push('/signin')
    }
  }, [user, router])

  const handleUpdatePassword = async (e) => {
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
      await updatePassword(password)
      setMessage('Wachtwoord succesvol bijgewerkt!')
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
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
          Wachtwoord bijwerken
        </h1>
        <p className="text-sm text-slate-600">
          Voer je nieuwe wachtwoord hieronder in
        </p>
      </div>
      
      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Nieuw wachtwoord
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-[#222c56] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors"
              placeholder="Voer nieuw wachtwoord in"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
              Bevestig nieuw wachtwoord
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-[#222c56] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82cff4] focus:border-transparent transition-colors"
              placeholder="Bevestig nieuw wachtwoord"
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
              <span>Bijwerken...</span>
            </div>
          ) : (
            'Wachtwoord bijwerken'
          )}
        </button>
      </form>
    </div>
  )
}
