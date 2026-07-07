import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from '@blinkdotnew/ui'
import { Package, Clock, MapPin, Phone, CreditCard, ChefHat, Bike, CheckCircle, Volume2, VolumeX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type OrderStatus = 'pending' | 'preparing' | 'out_for_delivery' | 'delivered'

interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
}

interface Order {
  id: string
  restaurant_id: string
  customer_name: string
  customer_phone: string
  address: string
  payment_method: string
  status: OrderStatus
  total: number
  notes: string | null
  created_at: string
  items?: OrderItem[]
}

const STATUS_MAP: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', variant: 'destructive', icon: <Clock className="h-3.5 w-3.5" /> },
  preparing: { label: 'Preparando', variant: 'secondary', icon: <ChefHat className="h-3.5 w-3.5" /> },
  out_for_delivery: { label: 'Saiu p/ Entrega', variant: 'outline', icon: <Bike className="h-3.5 w-3.5" /> },
  delivered: { label: 'Entregue', variant: 'default', icon: <CheckCircle className="h-3.5 w-3.5" /> },
}

const STATUS_NEXT: Record<OrderStatus, OrderStatus | null> = {
  pending: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: null,
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Simula toque de telefone antigo usando Web Audio API
function createPhoneRinger() {
  let intervalId: ReturnType<typeof setInterval> | null = null
  let ctx: AudioContext | null = null

  function ringOnce() {
    try {
      if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      ctx.resume()

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx!.createOscillator()
        const gain = ctx!.createGain()
        osc.connect(gain)
        gain.connect(ctx!.destination)
        osc.type = 'square'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.3, ctx!.currentTime + start)
        gain.gain.setValueAtTime(0, ctx!.currentTime + start + duration)
        osc.start(ctx!.currentTime + start)
        osc.stop(ctx!.currentTime + start + duration + 0.05)
      }

      const t = ctx.currentTime
      // Padrão clássico de telefone: DRING-DRING (dois bips curtos)
      playTone(480, 0, 0.1)
      playTone(480, 0.12, 0.1)
      playTone(480, 0.28, 0.1)
      playTone(480, 0.40, 0.1)
    } catch (e) {}
  }

  function start() {
    ringOnce()
    intervalId = setInterval(ringOnce, 1800)
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  return { start, stop }
}

// Instância global do ringer
const phoneRinger = createPhoneRinger()

export function OrdersDashboard({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [isRinging, setIsRinging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const soundEnabledRef = useRef(false)
  const isRingingRef = useRef(false)

  const stopRinging = useCallback(() => {
    if (isRingingRef.current) {
      phoneRinger.stop()
      isRingingRef.current = false
      setIsRinging(false)
    }
  }, [])

  const startRinging = useCallback(() => {
    if (!isRingingRef.current && soundEnabledRef.current) {
      phoneRinger.start()
      isRingingRef.current = true
      setIsRinging(true)
    }
  }, [])

  const fetchOrders = useCallback(async (notify = false) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('restaurant_id', restaurantId)
      .neq('status', 'delivered')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const currentIds = new Set(data.map((o: any) => o.id))
      const hasNewOrder = notify && data.some((o: any) => !prevIdsRef.current.has(o.id))

      if (hasNewOrder) {
        toast.success('Novo pedido recebido! 🎉')
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        startRinging()
      }

      // Para o toque se não houver mais pedidos pendentes
      const hasPending = data.some((o: any) => o.status === 'pending')
      if (!hasPending) stopRinging()

      prevIdsRef.current = currentIds
      setOrders(data as Order[])
      setLastUpdate(new Date())
    }
    setLoading(false)
  }, [restaurantId, startRinging, stopRinging])

  const handleEnableSound = () => {
    phoneRinger.start()
    setTimeout(() => phoneRinger.stop(), 900)
    soundEnabledRef.current = true
    setSoundEnabled(true)
    toast.success('Som ativado! 🔔')
  }

  const handleDisableSound = () => {
    stopRinging()
    soundEnabledRef.current = false
    setSoundEnabled(false)
    toast.success('Som desativado')
  }

  useEffect(() => {
    fetchOrders(false)
  }, [fetchOrders])

  useEffect(() => {
    const interval = setInterval(() => fetchOrders(true), 8000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  useEffect(() => {
    const channel = supabase
      .channel('orders-admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => fetchOrders(true)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurantId, fetchOrders])

  const updateStatus = async (orderId: string, currentStatus: OrderStatus) => {
    const next = STATUS_NEXT[currentStatus]
    if (!next) return

    // Para o toque ao iniciar preparo
    if (currentStatus === 'pending') stopRinging()

    const { error } = await supabase.from('orders').update({ status: next }).eq('id', orderId)
    if (error) {
      toast.error('Erro ao atualizar status')
    } else {
      setOrders(prev => {
        const updated = prev.map(o => o.id === orderId ? { ...o, status: next } : o)
        // Verifica se ainda há pendentes
        const hasPending = updated.some(o => o.status === 'pending')
        if (!hasPending) stopRinging()
        return updated
      })
      toast.success(`Status: ${STATUS_MAP[next].label}`)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => fetchOrders(false)} className="text-xs h-8">
            Atualizar
          </Button>
          {!soundEnabled ? (
            <Button size="sm" variant="default" onClick={handleEnableSound} className="text-xs h-8 gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />
              Ativar som
            </Button>
          ) : (
            <Button size="sm" variant={isRinging ? 'destructive' : 'outline'} onClick={isRinging ? stopRinging : handleDisableSound} className="text-xs h-8 gap-1.5">
              {isRinging ? (
                <><VolumeX className="h-3.5 w-3.5" /> Parar toque</>
              ) : (
                <><Volume2 className="h-3.5 w-3.5" /> Som ativo</>
              )}
            </Button>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">Nenhum pedido ativo</h3>
          <p className="text-sm text-muted-foreground mt-1">Os novos pedidos aparecerão aqui em tempo real.</p>
        </div>
      ) : (
        <div ref={scrollRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map(order => (
            <Card key={order.id} className={cn('transition-all', order.status === 'pending' && 'ring-2 ring-primary/30')}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{order.customer_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{formatTime(order.created_at)}</p>
                  </div>
                  <Badge variant={STATUS_MAP[order.status].variant} className="gap-1 text-xs">
                    {STATUS_MAP[order.status].icon}
                    {STATUS_MAP[order.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs text-muted-foreground">
                  {order.customer_phone && (
                    <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {order.customer_phone}</div>
                  )}
                  <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {order.address}</div>
                  <div className="flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> {order.payment_method}</div>
                </div>

                {order.items && order.items.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <ul className="space-y-1 text-sm">
                      {order.items.map(item => (
                        <li key={item.id} className="flex justify-between">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span className="text-muted-foreground">{formatBRL(item.unit_price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {order.notes && (
                  <p className="text-xs text-muted-foreground italic border-t border-border pt-2">Obs: {order.notes}</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-lg font-bold text-primary">{formatBRL(order.total)}</span>
                  {order.status !== 'delivered' && (
                    <Button
                      size="sm"
                      variant={order.status === 'pending' ? 'default' : 'secondary'}
                      onClick={() => updateStatus(order.id, order.status)}
                    >
                      {order.status === 'pending' && 'Iniciar Preparo'}
                      {order.status === 'preparing' && 'Sair p/ Entrega'}
                      {order.status === 'out_for_delivery' && 'Marcar Entregue'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
