import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface Restaurant {
  id: string
  name: string
  slug: string
  owner_id: string
  logo_url: string | null
  phone: string | null
  address: string | null
  is_open: boolean
  created_at?: string
}

export function useRestaurant() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRestaurant = useCallback(async (user: User) => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (fetchError) {
      setError(fetchError.message)
      setRestaurant(null)
    } else {
      setRestaurant(data as Restaurant | null)
    }
    setLoading(false)
  }, [])

  const createRestaurant = useCallback(async (user: User, name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    const { data, error: createError } = await supabase
      .from('restaurants')
      .insert({
        owner_id: user.id,
        name,
        slug,
        is_open: true,
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      return null
    }

    setRestaurant(data as Restaurant)
    setError(null)
    return data as Restaurant
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchRestaurant(session.user)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchRestaurant(session.user)
        } else {
          setRestaurant(null)
          setLoading(false)
          setError(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchRestaurant])

  return { restaurant, loading, error, createRestaurant, refetch: fetchRestaurant }
}
