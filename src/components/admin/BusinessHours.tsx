import { useState, useEffect, useCallback } from 'react'
import { Button, Switch, Skeleton } from '@blinkdotnew/ui'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
]

interface BusinessHour {
  id?: string
  restaurant_id: string
  day_of_week: number
  open_time: string
  close_time: string
  is_active: boolean
}

export function BusinessHours({ restaurantId }: { restaurantId: string }) {
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchHours = useCallback(async () => {
    const { data, error } = await supabase
      .from('business_hours')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('day_of_week')

    if (!error && data) {
      // Garante todos os 7 dias presentes
      const map = new Map(data.map((h: BusinessHour) => [h.day_of_week, h]))
      const full = DAYS.map(d => map.get(d.value) || {
        restaurant_id: restaurantId,
        day_of_week: d.value,
        open_time: '18:00',
        close_time: '23:00',
        is_active: d.value >= 1 && d.value <= 6, // seg-sáb ativo por padrão
      })
      setHours(full as BusinessHour[])
    }
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { fetchHours() }, [fetchHours])

  const updateHour = (dayOfWeek: number, field: keyof BusinessHour, value: any) => {
    setHours(prev => prev.map(h => h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('business_hours')
        .upsert(
          hours.map(h => ({ ...h, restaurant_id: restaurantId })),
          { onConflict: 'restaurant_id,day_of_week' }
        )
      if (error) throw error
      toast.success('Horários salvos!')
      fetchHours()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
    </div>
  )

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Horário de funcionamento</h2>
        <p className="text-sm text-muted-foreground">
          O cardápio abre e fecha automaticamente nos horários definidos.
          O botão no painel sempre tem prioridade.
        </p>
      </div>

      <div className="space-y-2">
        {DAYS.map(day => {
          const h = hours.find(x => x.day_of_week === day.value)
          if (!h) return null
          return (
            <div key={day.value} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${h.is_active ? 'border-border bg-background' : 'border-border/50 bg-muted/30 opacity-60'}`}>
              {/* Toggle ativo */}
              <Switch
                checked={h.is_active}
                onCheckedChange={v => updateHour(day.value, 'is_active', v)}
              />

              {/* Nome do dia */}
              <span className="text-sm font-medium w-28 shrink-0">{day.label}</span>

              {/* Horários */}
              {h.is_active ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={h.open_time}
                    onChange={e => updateHour(day.value, 'open_time', e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">até</span>
                  <input
                    type="time"
                    value={h.close_time}
                    onChange={e => updateHour(day.value, 'close_time', e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground flex-1">Fechado</span>
              )}
            </div>
          )
        })}
      </div>

      <Button onClick={saveAll} disabled={saving} className="w-full sm:w-auto">
        {saving ? 'Salvando...' : 'Salvar horários'}
      </Button>

      <div className="rounded-lg bg-accent px-4 py-3 space-y-1">
        <p className="text-xs font-medium text-accent-foreground">Como funciona</p>
        <p className="text-xs text-muted-foreground">O sistema verifica o horário a cada minuto e abre/fecha automaticamente. Se você fechar pelo botão manualmente, o sistema respeita sua decisão até você ligar novamente.</p>
      </div>
    </div>
  )
}
