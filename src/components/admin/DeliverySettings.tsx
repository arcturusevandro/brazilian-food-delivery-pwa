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
  const normalized = value
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace(',', '.')

  const parsed = Number.parseFloat(normalized)

  return Number.isFinite(parsed) ? parsed : 0
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
          'Nenhum bairro foi cadastrado.',
        )
        return
      }

      setSavingUnifiedFee(true)

      try {
        const { error: zonesError } =
          await supabase
            .from('delivery_zones')
            .update({
              fee,
            })
            .eq(
              'restaurant_id',
              restaurantId,
            )

        if (zonesError) {
          throw zonesError
        }

        const { error: settingsError } =
          await supabase
            .from('delivery_settings')
            .upsert(
              {
                ...settings,
                restaurant_id:
                  restaurantId,
                type: 'by_neighborhood',
                fixed_fee: fee,
                updated_at:
                  new Date().toISOString(),
              },
              {
                onConflict:
                  'restaurant_id',
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
          fee
            .toFixed(2)
            .replace('.', ','),
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
            'Erro ao atualizar a taxa de entrega',
        )
      } finally {
        setSavingUnifiedFee(false)
      }
    }

  const addZone = async () => {
    const neighborhood =
      newNeighborhood.trim()

    if (!neighborhood) {
      toast.error(
        'Digite o nome do bairro.',
      )
      return
    }

    const duplicatedZone =
      zones.some(
        (zone) =>
          zone.neighborhood
            .trim()
            .toLocaleLowerCase('pt-BR') ===
          neighborhood
            .toLocaleLowerCase('pt-BR'),
      )

    if (duplicatedZone) {
      toast.error(
        'Este bairro já está cadastrado.',
      )
      return
    }

    const fee = parseMoney(unifiedFee)

    if (fee < 0) {
      toast.error(
        'A taxa não pode ser negativa.',
      )
      return
    }

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

      toast.success(
        'Bairro adicionado!',
      )

      setNewNeighborhood('')

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao adicionar bairro',
      )
    }
  }

  const deleteZone = async (
    id: string,
  ) => {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      toast.success(
        'Bairro removido!',
      )

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao remover bairro',
      )
    }
  }

  const toggleZone = async (
    zone: DeliveryZone,
  ) => {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({
          available:
            !zone.available,
        })
        .eq('id', zone.id)

      if (error) {
        throw error
      }

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao alterar disponibilidade',
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton