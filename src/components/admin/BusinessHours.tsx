import { useState, useEffect, useCallback } from 'react'
import { Button, Switch, Skeleton } from '@blinkdotnew/ui'
import { Plus, X } from 'lucide-react'
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
  open_time_2: string | null
  close_time_2: string | null
  is_active: boolean
}

function TimeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    />
  )
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

    if (!error) {
      const map = new Map((data || []).map((h: any) => [h.day_of_week, h]))
      const full = DAYS.map(d => map.get(d.value) || {
        restaurant_id: restaurantId,
        day_of_week: d.value,
        open_time: '18:00',
        close_time: '23:00',
        open_time_2: null,
        close_time_2: null,
        is_active: d.value >= 1 && d.value <= 6,
      })
      setHours(full as BusinessHour[])
    }
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { fetchHours() }, [fetchHours])

  const update = (day: number, field: keyof BusinessHour, value: any) => {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h))
  }

  const addSecondShift = (day: number) => {
    setHours(prev => prev.map(h => h.day_of_week === day
      ? { ...h, open_time_2: '13:00', close_time_2: '18:00' }
      : h
    ))
  }

  const removeSecondShift = (day: number) => {
    setHours(prev => prev.map(h => h.day_of_week === day
      ? { ...h, open_time_2: null, close_time_2: null }
      : h
    ))
  }

  const saveAll = async () => {
    // Valida horários
    for (const h of hours) {
      if (!h.is_active) continue
      if (!h.open_time || !h.close_time) {
        toast.error(`Preencha o horário de ${DAYS.find(d => d.value === h.day_of_week)?.label}`)
        return
      }
      if (h.open_time_2 && !h.close_time_2) {
        toast.error(`Preencha o horário do 2º turno de ${DAYS.find(d => d.value === h.day_of_week)?.label}`)
        return
      }
    }

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
      {[1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  )

  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Horário de funcionamento</h2>
        <p className="text-sm text-muted-foreground">
          Configure até 2 turnos por dia. O cardápio abre e fecha automaticamente.
        </p>
      </div>

      <div className="space-y-3">
        {DAYS.map(day => {
          const h = hours.find(x => x.day_of_week === day.value)
          if (!h) return null
          const hasSecondShift = h.open_time_2 !== null

          return (
            <div key={day.value} className={`rounded-lg border px-3 py-3 space-y-2.5 transition-all ${h.is_active ? 'border-border bg-background' : 'border-border/40 bg-muted/20'}`}>
              {/* Cabeçalho do dia */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={h.is_active}
                  onCheckedChange={v => update(day.value, 'is_active', v)}
                />
                <span className={`text-sm font-semibold w-32 shrink-0 ${!h.is_active ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {day.label}
                </span>
                {!h.is_active && <span className="text-xs text-muted-foreground">Fechado</span>}
              </div>

              {h.is_active && (
                <div className="pl-9 space-y-2">
                  {/* 1º Turno */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground w-14 shrink-0">1º turno</span>
                    <TimeInput value={h.open_time} onChange={v => update(day.value, 'open_time', v)} />
                    <span className="text-xs text-muted-foreground">às</span>
                    <TimeInput value={h.close_time} onChange={v => update(day.value, 'close_time', v)} />
                  </div>

                  {/* 2º Turno */}
                  {hasSecondShift ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">2º turno</span>
                      <TimeInput value={h.open_time_2 || ''} onChange={v => update(day.value, 'open_time_2', v)} />
                      <span className="text-xs text-muted-foreground">às</span>
                      <TimeInput value={h.close_time_2 || ''} onChange={v => update(day.value, 'close_time_2', v)} />
                      <button
                        onClick={() => removeSecondShift(day.value)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        title="Remover 2º turno"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addSecondShift(day.value)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar 2º turno
                    </button>
                  )}
                </div>
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
        <p className="text-xs text-muted-foreground">
          O sistema verifica os horários a cada minuto e abre/fecha automaticamente.
          Use 2 turnos para intervalos de almoço ou pausa entre períodos.
          O botão no painel sempre tem prioridade sobre o horário automático.
        </p>
      </div>
    </div>
  )
}
