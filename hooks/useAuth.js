import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      console.log('useAuth: Getting initial session...')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('useAuth: Initial session:', session ? { user: session.user.email } : null)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('useAuth: Auth state change:', event, session ? { user: session.user.email } : null)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    // Check if email is from allowed domains
    const allowedDomains = ['@ficare.nl', '@innoworks.ai']
    const isAllowedDomain = allowedDomains.some(domain => email.toLowerCase().endsWith(domain))
    
    if (!isAllowedDomain) {
      throw new Error('Alleen @ficare.nl en @innoworks.ai email adressen zijn toegestaan.')
    }

    console.log('Attempting signup with:', email)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) {
      console.error('Signup error:', error)
      throw error
    }
    console.log('Signup successful:', data)
    return data
  }

  const signIn = async (email, password) => {
    console.log('Attempting signin with:', email)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      console.error('Signin error:', error)
      throw error
    }
    console.log('Signin successful:', data)
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  const updatePassword = async (password) => {
    const { error } = await supabase.auth.updateUser({
      password: password
    })
    if (error) throw error
  }

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword
  }
}
