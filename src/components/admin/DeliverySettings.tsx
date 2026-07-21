import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Input,
  Label,
  Skeleton,
  Switch,
} from '@blinkdotnew/ui'
import {
  Plus,
  Trash2,
  Truck,
  Save,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface DeliveryZone {
  id: string
  restaurant_id: string
  neighborhood: string
  fee: number
  available: boolean
}

interface DeliverySettingsData {
  id?: string
  restaurant_id: string
  type: 'free' | 'fixed' | 'by_neighborhood'
  fixed_fee: number
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function parseMoney(value: string): number {
  const normalizedValue = value
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace(',', '.')

  const parsedValue = Number.parseFloat(normalizedValue)

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0
}

export function DeliverySettings({
  restaurantId,
}: {
  restaurantId: string
}) {
  const [settings, setSettings] =
    useState<DeliverySettingsData>({
      restaurant_id: restaurantId,
      type: 'free',
      fixed_fee: 0,
    })

  const [zones, setZones] =
    useState<DeliveryZone[]>([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [savingUnifiedFee, setSavingUnifiedFee] =
    useState(false)

  const [newNeighborhood, setNewNeighborhood] =
    useState('')

  const [unifiedFee, setUnifiedFee] =
    useState('5,00')

  const fetchData = useCallback(async () => {
    setLoading(true)

    try {
      const [settingsRes, zonesRes] =
        await Promise.all([
          supabase
            .from('delivery_settings')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .maybeSingle(),

          supabase
            .from('delivery_zones')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('neighborhood'),
        ])

      if (settingsRes.error) {
        throw settingsRes.error
      }

      if (zonesRes.error) {
        throw zonesRes.error
      }

      if (settingsRes.data) {
        setSettings(
          settingsRes.data as DeliverySettingsData,
        )
      }

      const loadedZones =
        (zonesRes.data || []) as DeliveryZone[]

      setZones(loadedZones)

      /*
       * Como a entrega utiliza taxa única,
       * o primeiro bairro define o valor exibido.
       */
      if (loadedZones.length > 0) {
        const currentFee =
          Number(loadedZones[0].fee) || 0

        setUnifiedFee(
          currentFee
            .toFixed(2)
            .replace('.', ','),
        )
      } else if (settingsRes.data) {
        const currentFee =
          Number(settingsRes.data.fixed_fee) || 0

        setUnifiedFee(
          currentFee
            .toFixed(2)
            .replace('.', ','),
        )
      }
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao carregar configurações de entrega',
      )
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveSettings = async () => {
    setSaving(true)

    try {
      const { error } = await supabase
        .from('delivery_settings')
        .upsert(
          {
            ...settings,
            restaurant_id: restaurantId,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: 'restaurant_id',
          },
        )

      if (error) {
        throw error
      }

      toast.success(
        'Configurações salvas!',
      )

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao salvar configurações',
      )
    } finally {
      setSaving(false)
    }
  }

  const saveUnifiedDeliveryFee =
    async () => {
      const fee = parseMoney(unifiedFee)

      if (fee < 0) {
        toast.error(
          'A taxa de entrega não pode ser negativa.',
        )
        return
      }

      if (zones.length === 0) {
        toast.error(
          'Nenhum bairro foi