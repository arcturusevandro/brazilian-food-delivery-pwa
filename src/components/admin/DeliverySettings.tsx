import { useState, useEffect, useCallback } from 'react'
import { Button, Input, Label, Skeleton, Switch } from '@blinkdotnew/ui'
import { Plus, Trash2, Truck } from 'lucide-react'
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

export function DeliverySettings({ restaurantId }: { restaurantId: string }) {
  const [settings, setSettings] = useState<DeliverySettingsData>({
    restaurant_id: restaurantId,
    type: 'free',
    fixed_fee: 0,
  })
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newNeighborhood, setNewNeighborhood] = useState('')
  const [newFee, setNewFee] = useState('')

  const fetchData = useCallback(async () => {
    const [settingsRes, zonesRes] = await Promise.all([
      supabase.from('delivery_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
      supabase.from('delivery_zones').select('*').eq('restaurant_id', restaurantId).order('neighborhood'),
    ])

    if (settingsRes.data) {
      setSettings(settingsRes.data as DeliverySettingsData)
    }
    if (!zonesRes.error) setZones(zonesRes.data as DeliveryZone[])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { fetchData() }, [fetchData])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('delivery_settings')
        .upsert({ ...settings, restaurant_id: restaurantId, updated_at: new Date().toISOString() },
          { onConflict: 'restaurant_id' })

      if (error) throw error
      toast.success('Configurações salvas!')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const addZone = async () => {
    if (!newNeighborhood.trim()) return
    const fee = newFee ? parseFloat(newFee.replace(',', '.')) : 0
    const { error } = await supabase.from('delivery_zones').insert({
      restaurant_id: restaurantId,
      neighborhood: newNeighborhood.trim(),
      fee,
      available: true,
    })
    if (error) { toast.error('Erro ao adicionar bairro'); return }
    toast.success('Bairro adicionado!')
    setNewNeighborhood('')
    setNewFee('')
    fetchData()
  }

  const deleteZone = async (id: string) => {
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    toast.success('Bairro removido!')
    fetchData()
  }

  const toggleZone = async (zone: DeliveryZone) => {
    const { error } = await supabase.from('delivery_zones')
      .update({ available: !zone.available }).eq('id', zone.id)
    if (error) { toast.error('Erro ao alterar'); return }
    fetchData()
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
    <div className="space-y-8 max-w-lg">
      {/* Tipo de taxa */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tipo de entrega</h2>
        <div className="grid grid-cols-1 gap-2">
          {[
            { value: 'free', label: '🎁 Grátis', desc: 'Entrega sem custo para o cliente' },
            { value: 'fixed', label: '💰 Taxa fixa', desc: 'Mesmo valor para qualquer endereço' },
            { value: 'by_neighborhood', label: '📍 Por bairro', desc: 'Valor diferente por bairro' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSettings(s => ({ ...s, type: opt.value as any }))}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-150 ${
                settings.type === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background hover:border-primary/40'
              }`}
            >
              <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                settings.type === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/40'
              }`} />
              <div>
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Taxa fixa */}
      {settings.type === 'fixed' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Valor da taxa fixa</h2>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                className="pl-9"
                placeholder="0,00"
                value={settings.fixed_fee || ''}
                onChange={e => setSettings(s => ({ ...s, fixed_fee: parseFloat(e.target.value.replace(',', '.')) || 0 }))}
                type="number"
                inputMode="decimal"
              />
            </div>
          </div>
        </section>
      )}

      {/* Por bairro */}
      {settings.type === 'by_neighborhood' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Bairros e taxas</h2>

          {zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-lg">
              <Truck className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum bairro cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {zones.map(zone => (
                <div key={zone.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border ${!zone.available && 'opacity-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{zone.neighborhood}</p>
                    <p className="text-xs text-muted-foreground">{zone.fee > 0 ? formatBRL(zone.fee) : 'Grátis'}</p>
                  </div>
                  <Switch checked={zone.available} onCheckedChange={() => toggleZone(zone)} />
                  <Button size="sm" variant="ghost" onClick={() => deleteZone(zone.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar bairro */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-sm font-medium">Adicionar bairro</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do bairro"
                value={newNeighborhood}
                onChange={e => setNewNeighborhood(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addZone()}
                className="flex-1"
              />
              <Input
                placeholder="Taxa R$"
                value={newFee}
                onChange={e => setNewFee(e.target.value)}
                className="w-24"
                type="number"
                inputMode="decimal"
              />
              <Button size="sm" onClick={addZone} disabled={!newNeighborhood.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Deixe a taxa vazia ou 0 para entrega grátis neste bairro.</p>
          </div>
        </section>
      )}

      <Button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto">
        {saving ? 'Salvando...' : 'Salvar configurações'}
      </Button>
    </div>
  )
}
