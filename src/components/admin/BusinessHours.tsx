import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Restaurant {
  id: string
  is_open: boolean
  manual_override: boolean
}

interface BusinessHour {
  day_of_week: number
  open_time: string
  close_time: string
  open_time_2: string | null
  close_time_2: string | null
  is_active: boolean
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function isInShift(current: number, open: string, close: string): boolean {
  const openMin = timeToMinutes(open)
  let closeMin = timeToMinutes(close)
  // Suporte a horários que passam da meia-noite
  if (closeMin <= openMin) closeMin += 24 * 60
  return current >= openMin && current < closeMin
}

function isCurrentlyOpen(hours: BusinessHour[]): boolean {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const todayHours = hours.find(h => h.day_of_week === dayOfWeek && h.is_active)
  if (!todayHours) return false

  // Verifica 1º turno
  const inFirstShift = isInShift(currentMinutes, todayHours.open_time, todayHours.close_time)
  if (inFirstShift) return true

  // Verifica 2º turno se existir
  if (todayHours.open_time_2 && todayHours.close_time_2) {
    const inSecondShift = isInShift(currentMinutes, todayHours.open_time_2, todayHours.close_time_2)
    if (inSecondShift) return true
  }

  return false
}

export function useBusinessHours(restaurant: Restaurant | null, onStatusChange: () => void) {
  const hoursRef = useRef<BusinessHour[]>([])
  const lastStatusRef = useRef<boolean | null>(null)

  const fetchAndCheck = useCallback(async () => {
    if (!restaurant) return
    if (restaurant.manual_override) return

    if (hoursRef.current.length === 0) {
      const { data } = await supabase
        .from('business_hours')
        .select('*')
        .eq('restaurant_id', restaurant.id)
      if (data) hoursRef.current = data as BusinessHour[]
    }

    if (hoursRef.current.length === 0) return

    const shouldBeOpen = isCurrentlyOpen(hoursRef.current)
    if (lastStatusRef.current === shouldBeOpen) return
    lastStatusRef.current = shouldBeOpen

    if (shouldBeOpen !== restaurant.is_open) {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_open: shouldBeOpen })
        .eq('id', restaurant.id)
      if (!error) onStatusChange()
    }
  }, [restaurant, onStatusChange])

  useEffect(() => {
    hoursRef.current = []
    lastStatusRef.current = null
  }, [restaurant?.id])

  useEffect(() => {
    fetchAndCheck()
    const interval = setInterval(fetchAndCheck, 60_000)
    return () => clearInterval(interval)
  }, [fetchAndCheck])
}

export async function toggleRestaurantManual(restaurantId: string, currentIsOpen: boolean): Promise<boolean> {
  const newIsOpen = !currentIsOpen
  const { error } = await supabase
    .from('restaurants')
    .update({ is_open: newIsOpen, manual_override: true })
    .eq('id', restaurantId)
  if (error) throw error
  return newIsOpen
}

export async function enableRestaurant(restaurantId: string): Promise<void> {
  const { error } = await supabase
    .from('restaurants')
    .update({ is_open: true, manual_override: false })
    .eq('id', restaurantId)
  if (error) throw error
}
