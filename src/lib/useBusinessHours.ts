// ── Hook de Horário Automático ───────────────────────────────────
// Verifica a cada minuto se o restaurante deve estar aberto ou fechado
// conforme os horários cadastrados em business_hours.
// O botão manual sobrescreve e fica nesse estado até o lojista mudar.

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
  is_active: boolean
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function isCurrentlyOpen(hours: BusinessHour[]): boolean {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const todayHours = hours.find(h => h.day_of_week === dayOfWeek && h.is_active)
  if (!todayHours) return false

  const openMinutes = timeToMinutes(todayHours.open_time)
  let closeMinutes = timeToMinutes(todayHours.close_time)

  // Suporte a horários que passam da meia-noite (ex: 22:00 - 02:00)
  if (closeMinutes <= openMinutes) closeMinutes += 24 * 60

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

export function useBusinessHours(restaurant: Restaurant | null, onStatusChange: () => void) {
  const hoursRef = useRef<BusinessHour[]>([])
  const lastStatusRef = useRef<boolean | null>(null)

  const fetchAndCheck = useCallback(async () => {
    if (!restaurant) return

    // Se manual_override está ativo, não mexe no status
    if (restaurant.manual_override) return

    // Busca horários se ainda não tiver
    if (hoursRef.current.length === 0) {
      const { data } = await supabase
        .from('business_hours')
        .select('*')
        .eq('restaurant_id', restaurant.id)
      if (data) hoursRef.current = data as BusinessHour[]
    }

    if (hoursRef.current.length === 0) return

    const shouldBeOpen = isCurrentlyOpen(hoursRef.current)

    // Só atualiza se o status mudou
    if (lastStatusRef.current === shouldBeOpen) return
    lastStatusRef.current = shouldBeOpen

    if (shouldBeOpen !== restaurant.is_open) {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_open: shouldBeOpen })
        .eq('id', restaurant.id)

      if (!error) {
        onStatusChange()
      }
    }
  }, [restaurant, onStatusChange])

  // Recarrega horários quando restaurante muda
  useEffect(() => {
    hoursRef.current = []
    lastStatusRef.current = null
  }, [restaurant?.id])

  // Verifica ao montar e a cada minuto
  useEffect(() => {
    fetchAndCheck()
    const interval = setInterval(fetchAndCheck, 60_000)
    return () => clearInterval(interval)
  }, [fetchAndCheck])
}

// ── Função para toggle manual com override ───────────────────────
export async function toggleRestaurantManual(
  restaurantId: string,
  currentIsOpen: boolean
): Promise<boolean> {
  const newIsOpen = !currentIsOpen
  const { error } = await supabase
    .from('restaurants')
    .update({
      is_open: newIsOpen,
      manual_override: true, // marca que o lojista assumiu controle
    })
    .eq('id', restaurantId)

  if (error) throw error
  return newIsOpen
}

// ── Função para resetar override (quando ligar pelo botão) ───────
export async function enableRestaurant(restaurantId: string): Promise<void> {
  const { error } = await supabase
    .from('restaurants')
    .update({
      is_open: true,
      manual_override: false, // libera controle automático
    })
    .eq('id', restaurantId)

  if (error) throw error
}
