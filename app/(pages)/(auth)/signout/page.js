"use client"

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function SignOutPage() {
  const { signOut, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const handleSignOut = async () => {
      if (user) {
        try {
          await signOut()
        } catch (error) {
          console.error('Error signing out:', error)
          // Still redirect even if there's an error
          router.push('/signin')
        }
      } else {
        // User is already signed out, redirect to signin
        router.push('/signin')
      }
    }

    handleSignOut()
  }, [signOut, user, router])

  return (
    <div className="text-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#222c56]">
          Uitloggen
        </h1>
        <p className="text-sm text-slate-600">
          Even geduld terwijl we je veilig uitloggen
        </p>
      </div>
      
      <div className="flex justify-center">
        <div className="w-8 h-8 border-3 border-[#82cff4]/30 border-t-[#82cff4] rounded-full animate-spin"></div>
      </div>
      
      <div className="text-xs text-slate-500">
        Doorverwijzen naar inlogpagina...
      </div>
    </div>
  )
}
