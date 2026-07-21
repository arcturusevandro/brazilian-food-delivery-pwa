import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Input,
  Label,
  Skeleton,
  Switch,
} from '@blinkdotnew/ui'
import {
  Plus,
  Save,
  Trash2,
  Truck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

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

interface DeliverySettingsProps {
  restaurantId: string
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function parseMoney(value: string): number {
  const normalized = value
    .trim()
    .replace('R$', '')
    .replace(',', '.')

  const parsed = Number.parseFloat(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

export function DeliverySettings({
  restaurantId,
}: DeliverySettingsProps) {
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

  const [savingSettings, setSavingSettings] =
    useState(false)

  const [savingFee, setSavingFee] =
    useState(false)

  const [newNeighborhood, setNewNeighborhood] =
    useState('')

  const [unifiedFee, setUnifiedFee] =
    useState('5,00')

  const fetchData = useCallback(async () => {
    setLoading(true)

    try {
      const [settingsResult, zonesResult] =
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

      if (settingsResult.error) {
        throw settingsResult.error
      }

      if (zonesResult.error) {
        throw zonesResult.error
      }

      if (settingsResult.data) {
        setSettings(
          settingsResult.data as DeliverySettingsData,
        )
      }

      const loadedZones =
        (zonesResult.data || []) as DeliveryZone[]

      setZones(loadedZones)

      if (loadedZones.length > 0) {
        const fee =
          Number(loadedZones[0].fee) || 0

        setUnifiedFee(
          fee.toFixed(2).replace('.', ','),
        )
      } else if (settingsResult.data) {
        const fee =
          Number(settingsResult.data.fixed_fee) || 0

        setUnifiedFee(
          fee.toFixed(2).replace('.', ','),
        )
      }
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao carregar as configurações.',
      )
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function saveSettings() {
    setSavingSettings(true)

    try {
      const { error } = await supabase
        .from('delivery_settings')
        .upsert(
          {
            ...settings,
            restaurant_id: restaurantId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'restaurant_id',
          },
        )

      if (error) {
        throw error
      }

      toast.success('Configurações salvas!')

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao salvar as configurações.',
      )
    } finally {
      setSavingSettings(false)
    }
  }

  async function saveUnifiedDeliveryFee() {
    const fee = parseMoney(unifiedFee)

    if (fee < 0) {
      toast.error(
        'A taxa não pode ser negativa.',
      )
      return
    }

    if (zones.length === 0) {
      toast.error(
        'Nenhum bairro está cadastrado.',
      )
      return
    }

    setSavingFee(true)

    try {
      const { error: zonesError } =
        await supabase
          .from('delivery_zones')
          .update({ fee })
          .eq('restaurant_id', restaurantId)

      if (zonesError) {
        throw zonesError
      }

      const { error: settingsError } =
        await supabase
          .from('delivery_settings')
          .upsert(
            {
              ...settings,
              restaurant_id: restaurantId,
              type: 'by_neighborhood',
              fixed_fee: fee,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: 'restaurant_id',
            },
          )

      if (settingsError) {
        throw settingsError
      }

      setSettings((current) => ({
        ...current,
        type: 'by_neighborhood',
        fixed_fee: fee,
      }))

      setUnifiedFee(
        fee.toFixed(2).replace('.', ','),
      )

      toast.success(
        `Taxa de ${formatBRL(
          fee,
        )} aplicada a todos os bairros!`,
      )

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao atualizar a taxa.',
      )
    } finally {
      setSavingFee(false)
    }
  }

  async function addZone() {
    const neighborhood =
      newNeighborhood.trim()

    if (!neighborhood) {
      toast.error(
        'Digite o nome do bairro.',
      )
      return
    }

    const alreadyExists = zones.some(
      (zone) =>
        zone.neighborhood
          .trim()
          .toLocaleLowerCase('pt-BR') ===
        neighborhood.toLocaleLowerCase('pt-BR'),
    )

    if (alreadyExists) {
      toast.error(
        'Este bairro já está cadastrado.',
      )
      return
    }

    const fee = parseMoney(unifiedFee)

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .insert({
          restaurant_id: restaurantId,
          neighborhood,
          fee,
          available: true,
        })

      if (error) {
        throw error
      }

      setNewNeighborhood('')

      toast.success('Bairro adicionado!')

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao adicionar o bairro.',
      )
    }
  }

  async function deleteZone(id: string) {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      toast.success('Bairro removido!')

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao remover o bairro.',
      )
    }
 