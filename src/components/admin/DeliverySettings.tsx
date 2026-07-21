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
    .replace(/\s/g, '')
    .replace(',', '.')

  const parsed = Number.parseFloat(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function moneyInputValue(value: number): string {
  return Number(value || 0)
    .toFixed(2)
    .replace('.', ',')
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

  const [zoneFees, setZoneFees] =
    useState<Record<string, string>>({})

  const [loading, setLoading] =
    useState(true)

  const [savingSettings, setSavingSettings] =
    useState(false)

  const [savingZoneId, setSavingZoneId] =
    useState<string | null>(null)

  const [newNeighborhood, setNewNeighborhood] =
    useState('')

  const [newFee, setNewFee] =
    useState('5,00')

  const [addingZone, setAddingZone] =
    useState(false)

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

      const loadedFees: Record<string, string> = {}

      loadedZones.forEach((zone) => {
        loadedFees[zone.id] =
          moneyInputValue(Number(zone.fee))
      })

      setZoneFees(loadedFees)
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao carregar as configurações de entrega.',
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

      toast.success(
        'Configurações de entrega salvas!',
      )

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

  async function saveZoneFee(zone: DeliveryZone) {
    const feeText =
      zoneFees[zone.id] ?? '0,00'

    const fee = parseMoney(feeText)

    if (fee < 0) {
      toast.error(
        'A taxa não pode ser negativa.',
      )
      return
    }

    setSavingZoneId(zone.id)

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({
          fee,
        })
        .eq('id', zone.id)
        .eq('restaurant_id', restaurantId)

      if (error) {
        throw error
      }

      setZoneFees((current) => ({
        ...current,
        [zone.id]: moneyInputValue(fee),
      }))

      toast.success(
        `Taxa de ${zone.neighborhood} atualizada para ${formatBRL(fee)}!`,
      )

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao atualizar a taxa do bairro.',
      )
    } finally {
      setSavingZoneId(null)
    }
  }

  async function addZone() {
    const neighborhood =
      newNeighborhood.trim()

    const fee = parseMoney(newFee)

    if (!neighborhood) {
      toast.error(
        'Digite o nome do bairro.',
      )
      return
    }

    if (fee < 0) {
      toast.error(
        'A taxa não pode ser negativa.',
      )
      return
    }

    const alreadyExists =
      zones.some((zone) => {
        return (
          zone.neighborhood
            .trim()
            .toLocaleLowerCase('pt-BR') ===
          neighborhood
            .toLocaleLowerCase('pt-BR')
        )
      })

    if (alreadyExists) {
      toast.error(
        'Este bairro já está cadastrado.',
      )
      return
    }

    setAddingZone(true)

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
      setNewFee('5,00')

      toast.success(
        'Bairro adicionado!',
      )

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao adicionar o bairro.',
      )
    } finally {
      setAddingZone(false)
    }
  }

  async function deleteZone(
    zone: DeliveryZone,
  ) {
    const confirmed = window.confirm(
      `Deseja remover o bairro "${zone.neighborhood}"?`,
    )

    if (!confirmed) {
      return
    }

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zone.id)
        .eq('restaurant_id', restaurantId)

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
          'Erro ao remover o bairro.',
      )
    }
  }

  async function toggleZone(
    zone: DeliveryZone,
  ) {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({
          available: !zone.available,
        })
        .eq('id', zone.id)
        .eq('restaurant_id', restaurantId)

      if (error) {
        throw error
      }

      toast.success(
        !zone.available
          ? `${zone.neighborhood} ativado!`
          : `${zone.neighborhood} desativado!`,
      )

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao alterar a disponibilidade.',
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Tipo de entrega
        </h2>

        <div className="grid grid-cols-1 gap-2">
          {[
            {
              value: 'free',
              label: '🎁 Grátis',
              description:
                'Entrega sem custo para o cliente',
            },
            {
              value: 'fixed',
              label: '💰 Taxa fixa',
              description:
                'Mesmo valor para qualquer endereço',
            },
            {
              value: 'by_neighborhood',
              label: '📍 Por bairro',
              description:
                'Defina um valor diferente para cada bairro',
            },
          ].map((option) => {
            const selected =
              settings.type === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSettings((current) => ({
                    ...current,
                    type:
                      option.value as
                        DeliverySettingsData['type'],
                  }))
                }}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background hover:border-primary/40'
                }`}
              >
                <div
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                    selected
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/40'
                  }`}
                />

                <div>
                  <p className="text-sm font-medium text-foreground">
                    {option.label}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {settings.type === 'fixed' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Valor da taxa fixa
          </h2>

          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>

            <Input
              className="pl-9"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={
                settings.fixed_fee || ''
              }
              onChange={(event) => {
                setSettings((current) => ({
                  ...current,
                  fixed_fee:
                    Number(event.target.value) || 0,
                }))
              }}
            />
          </div>
        </section>
      )}

      {settings.type ===
        'by_neighborhood' && (
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">
              Bairros e taxas
            </h2>

            <p className="text-xs text-muted-foreground">
              Altere o valor e pressione
              Salvar no bairro desejado.
            </p>
          </div>

          {zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
              <Truck className="mb-2 h-8 w-8 text-muted-foreground/30" />

              <p className="text-sm text-muted-foreground">
                Nenhum bairro cadastrado
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`rounded-lg border border-border p-3 ${
                    zone.available
                      ? ''
                      : 'opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {zone.neighborhood}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Taxa cadastrada:{' '}
                        {Number(zone.fee) > 0
                          ? formatBRL(
                              Number(zone.fee),
                            )
                          : 'Grátis'}
                      </p>
                    </div>

                    <Switch
                      checked={zone.available}
                      onCheckedChange={() => {
                        toggleZone(zone)
                      }}
                    />

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        deleteZone(zone)
                      }}
                      aria-label={`Remover ${zone.neighborhood}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        R$
                      </span>

                      <Input
                        className="pl-9"
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={
                          zoneFees[zone.id] ??
                          moneyInputValue(
                            Number(zone.fee),
                          )
                        }
                        onChange={(event) => {
                          const value =
                            event.target.value

                          setZoneFees(
                            (current) => ({
                              ...current,
                              [zone.id]: value,
                            }),
                          )
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter'
                          ) {
                            saveZoneFee(zone)
                          }
                        }}
                      />
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        saveZoneFee(zone)
                      }}
                      disabled={
                        savingZoneId === zone.id
                      }
                    >
                      <Save className="mr-2 h-4 w-4" />

                      {savingZoneId === zone.id
                        ? 'Salvando...'
                        : 'Salvar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <Label className="text-sm font-medium">
              Adicionar bairro
            </Label>

            <Input
              placeholder="Nome do bairro"
              value={newNeighborhood}
              onChange={(event) => {
                setNewNeighborhood(
                  event.target.value,
                )
              }}
            />

            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>

                <Input
                  className="pl-9"
                  type="text"
                  inputMode="decimal"
                  placeholder="5,00"
                  value={newFee}
                  onChange={(event) => {
                    setNewFee(
                      event.target.value,
                    )
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter'
                    ) {
                      addZone()
                    }
                  }}
                />
              </div>

              <Button
                onClick={addZone}
                disabled={
                  addingZone ||
                  !newNeighborhood.trim()
                }
              >
                <Plus className="mr-2 h-4 w-4" />

                {addingZone
                  ? 'Adicionando...'
                  : 'Adicionar'}
              </Button>
            </div>
          </div>
        </section>
      )}

      <Button
        className="w-full sm:w-auto"
        onClick={saveSettings}
        disabled={savingSettings}
      >
        {savingSettings
          ? 'Salvando...'
          : 'Salvar configurações'}
      </Button>
    </div>
  )
}