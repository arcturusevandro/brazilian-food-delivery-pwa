import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Label, Skeleton, Switch } from '@blinkdotnew/ui'
import { Plus, Save, Trash2, Truck } from 'lucide-react'
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
  const parsed = Number.parseFloat(
    value.trim().replace('R$', '').replace(',', '.'),
  )

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

      const currentFee =
        loadedZones.length > 0
          ? Number(loadedZones[0].fee) || 0
          : Number(settingsResult.data?.fixed_fee) || 0

      setUnifiedFee(
        currentFee.toFixed(2).replace('.', ','),
      )
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
              updated_at: new Date().toISOString(),
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

    const alreadyExists =
      zones.some(
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

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .insert({
          restaurant_id: restaurantId,
          neighborhood,
          fee: parseMoney(unifiedFee),
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

      if (error) {
        throw error
      }

      await fetchData()
    } catch (error: any) {
      toast.error(
        error.message ||
          'Erro ao alterar o bairro.',
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

  const currentFee =
    parseMoney(unifiedFee)

  return (
    <div className="max-w-lg space-y-8">
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
                'Lista de bairros atendidos com taxa única',
            },
          ].map((option) => {
            const selected =
              settings.type === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setSettings(
                    (current) => ({
                      ...current,
                      type:
                        option.value as
                          DeliverySettingsData['type'],
                    }),
                  )
                }
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
              value={settings.fixed_fee || ''}
              onChange={(event) =>
                setSettings(
                  (current) => ({
                    ...current,
                    fixed_fee:
                      Number(event.target.value) || 0,
                  }),
                )
              }
            />
          </div>
        </section>
      )}

      {settings.type ===
        'by_neighborhood' && (
        <section className="space-y-5">
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div>
              <h2 className="text-lg font-semibold">
                Taxa única de entrega
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Este valor será aplicado a todos os
                bairros cadastrados.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>

                <Input
                  className="pl-9"
                  type="text"
                  inputMode="decimal"
                  placeholder="5,00"
                  value={unifiedFee}
                  onChange={(event) =>
                    setUnifiedFee(
                      event.target.value,
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter'
                    ) {
                      saveUnifiedDeliveryFee()
                    }
                  }}
                />
              </div>

              <Button
                onClick={
                  saveUnifiedDeliveryFee
                }
                disabled={savingFee}
              >
                <Save className="mr-2 h-4 w-4" />

                {savingFee
                  ? 'Aplicando...'
                  : 'Aplicar taxa'}
              </Button>
            </div>

            <div className="rounded-md bg-background/70 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Taxa atual
              </p>

              <p className="text-lg font-bold">
                {formatBRL(currentFee)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">
                Bairros atendidos
              </h2>

              <p className="text-xs text-muted-foreground">
                {zones.length}{' '}
                {zones.length === 1
                  ? 'bairro cadastrado'
                  : 'bairros cadastrados'}
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
              <div className="space-y-2">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`flex items-center gap-3 rounded-lg border border-border p-3 ${
                      zone.available
                        ? ''
                        : 'opacity-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {zone.neighborhood}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {Number(zone.fee) > 0
                          ? formatBRL(
                              Number(zone.fee),
                            )
                          : 'Grátis'}
                      </p>
                    </div>

                    <Switch
                      checked={zone.available}
                      onCheckedChange={() =>
                        toggleZone(zone)
                      }
                    />

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        deleteZone(zone.id)
                      }
                      aria-label={`Remover ${zone.neighborhood}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-sm font-medium">
              Adicionar bairro
            </Label>

            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Nome do bairro"
                value={newNeighborhood}
                onChange={(event) =>
                  setNewNeighborhood(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter'
                  ) {
                    addZone()
                  }
                }}
              />

              <Button
                size="sm"
                onClick={addZone}
                disabled={
                  !newNeighborhood.trim()
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              O novo bairro receberá a taxa atual de{' '}
              {formatBRL(currentFee)}.
            </p>
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