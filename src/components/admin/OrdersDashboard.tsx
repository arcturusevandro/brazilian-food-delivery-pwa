import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from '@blinkdotnew/ui'
import { Package, Clock, MapPin, Phone, CreditCard, ChefHat, Bike, CheckCircle, Volume2, VolumeX, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { printOrder, PrinterConfig } from '@/lib/usePrinter'

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
  neighborhood: string | null
  payment_method: string
  status: OrderStatus
  total: number
  delivery_fee: number | null
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

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Dinheiro', card: 'Cartão', pix: 'Pix',
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Toque de telefone antigo ─────────────────────────────────────
let ringerCtx: AudioContext | null = null
let ringerInterval: ReturnType<typeof setInterval> | null = null
let ringerActive = false

function getRingerCtx(): AudioContext {
  if (!ringerCtx || ringerCtx.state === 'closed') {
    ringerCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return ringerCtx
}

function playRingCycle() {
  try {
    const ctx = getRingerCtx()
    ctx.resume()
    const now = ctx.currentTime
    const makeTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sawtooth'; osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.35, now + start + 0.01)
      gain.gain.setValueAtTime(0.35, now + start + dur - 0.02)
      gain.gain.linearRampToValueAtTime(0, now + start + dur)
      osc.start(now + start); osc.stop(now + start + dur + 0.02)
    }
    makeTone(440, 0.00, 0.18); makeTone(480, 0.02, 0.18)
    makeTone(440, 0.20, 0.18); makeTone(480, 0.22, 0.18)
    makeTone(440, 0.55, 0.18); makeTone(480, 0.57, 0.18)
    makeTone(440, 0.75, 0.18); makeTone(480, 0.77, 0.18)
  } catch (e) {}
}

function startRinger() {
  if (ringerActive) return
  ringerActive = true
  playRingCycle()
  ringerInterval = setInterval(playRingCycle, 2200)
}

function stopRinger() {
  ringerActive = false
  if (ringerInterval) { clearInterval(ringerInterval); ringerInterval = null }
}

function testRing() {
  try { getRingerCtx().resume().then(() => playRingCycle()) } catch {}
}
// ────────────────────────────────────────────────────────────────

function loadPrinterConfig(): PrinterConfig {
  try {
    const saved = localStorage.getItem('printer_config')
    if (saved) return JSON.parse(saved)
  } catch {}
  return { connection: 'none', paperWidth: '80mm', autoprint: false }
}

export function OrdersDashboard({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [isRinging, setIsRinging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const soundEnabledRef = useRef(false)
  const printerConfigRef = useRef<PrinterConfig>(loadPrinterConfig())

  // Atualiza config da impressora ao mudar localStorage
  useEffect(() => {
    const handler = () => { printerConfigRef.current = loadPrinterConfig() }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const handleStopRinging = useCallback(() => {
    stopRinger(); setIsRinging(false)
  }, [])

  const handleStartRinging = useCallback(() => {
    if (!soundEnabledRef.current) return
    startRinger(); setIsRinging(true)
  }, [])

  const handlePrintOrder = useCallback(async (order: Order) => {
    const config = printerConfigRef.current
    if (config.connection === 'none') return
    try {
      await printOrder({
        id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        address: order.address,
        neighborhood: order.neighborhood,
        payment_method: order.payment_method,
        notes: order.notes,
        total: order.total,
        delivery_fee: order.delivery_fee || 0,
        created_at: order.created_at,
        items: (order.items || []).map(i => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      }, config)
      toast.success('Pedido impresso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao imprimir')
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
      const newOrders = notify ? data.filter((o: any) => !prevIdsRef.current.has(o.id)) : []

      if (newOrders.length > 0) {
        toast.success(`${newOrders.length === 1 ? 'Novo pedido recebido' : `${newOrders.length} novos pedidos`}! 🎉`)
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        handleStartRinging()

        // Impressão automática
        const config = printerConfigRef.current
        if (config.connection !== 'none' && config.autoprint) {
          for (const order of newOrders) {
            await handlePrintOrder(order as Order)
          }
        }
      }

      const hasPending = data.some((o: any) => o.status === 'pending')
      if (!hasPending) { stopRinger(); setIsRinging(false) }

      prevIdsRef.current = currentIds
      setOrders(data as Order[])
      setLastUpdate(new Date())
    }
    setLoading(false)
  }, [restaurantId, handleStartRinging, handlePrintOrder])

  const handleEnableSound = () => {
    testRing(); soundEnabledRef.current = true; setSoundEnabled(true)
    toast.success('Som ativado! 🔔')
  }

  const handleDisableSound = () => {
    handleStopRinging(); soundEnabledRef.current = false; setSoundEnabled(false)
    toast.success('Som desativado')
  }

  useEffect(() => { fetchOrders(false) }, [fetchOrders])
  useEffect(() => {
    const interval = setInterval(() => fetchOrders(true), 8000)
    return () => clearInterval(interval)
  }, [fetchOrders])
  useEffect(() => {
    const channel = supabase.channel('orders-admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => fetchOrders(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurantId, fetchOrders])

  const updateStatus = async (order: Order, currentStatus: OrderStatus) => {
    const next = STATUS_NEXT[currentStatus]
    if (!next) return

    if (currentStatus === 'pending') {
      handleStopRinging()
      // Impressão manual ao clicar Iniciar Preparo
      const config = printerConfigRef.current
      if (config.connection !== 'none' && !config.autoprint) {
        await handlePrintOrder(order)
      }
    }

    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id)
    if (error) {
      toast.error('Erro ao atualizar status')
    } else {
      setOrders(prev => {
        const updated = prev.map(o => o.id === order.id ? { ...o, status: next } : o)
        const hasPending = updated.some(o => o.status === 'pending')
        if (!hasPending) { stopRinger(); setIsRinging(false) }
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

  const printerConfig = loadPrinterConfig()

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => fetchOrders(false)} className="text-xs h-8">Atualizar</Button>
          {!soundEnabled ? (
            <Button size="sm" variant="default" onClick={handleEnableSound} className="text-xs h-8 gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />Ativar som
            </Button>
          ) : isRinging ? (
            <Button size="sm" variant="destructive" onClick={handleStopRinging} className="text-xs h-8 gap-1.5 animate-pulse">
              <VolumeX className="h-3.5 w-3.5" />Parar toque
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleDisableSound} className="text-xs h-8 gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />Som ativo
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
          {orders.map(order => {
            const subtotal = order.total - (order.delivery_fee || 0)
            return (
              <Card key={order.id} className={cn('transition-all', order.status === 'pending' && 'ring-2 ring-primary/30')}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{order.customer_name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                    </div>
                    <Badge variant={STATUS_MAP[order.status].variant} className="gap-1 text-xs shrink-0">
                      {STATUS_MAP[order.status].icon}
                      {STATUS_MAP[order.status].label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Dados do cliente */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {order.customer_phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {order.customer_phone}</div>}
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{order.address}{order.neighborhood ? ` — ${order.neighborhood}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3" />
                      {PAYMENT_LABEL[order.payment_method] || order.payment_method}
                    </div>
                  </div>

                  {/* Itens completos */}
                  {order.items && order.items.length > 0 && (
                    <div className="border-t border-border pt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Itens</p>
                      <ul className="space-y-1">
                        {order.items.map(item => (
                          <li key={item.id} className="flex justify-between text-sm">
                            <span className="flex-1 pr-2">{item.quantity}x {item.product_name}</span>
                            <span className="text-muted-foreground shrink-0">{formatBRL(item.unit_price * item.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Observações */}
                  {order.notes && (
                    <div className="rounded-md bg-accent px-2.5 py-1.5">
                      <p className="text-xs text-accent-foreground"><span className="font-medium">Obs:</span> {order.notes}</p>
                    </div>
                  )}

                  {/* Totais */}
                  <div className="border-t border-border pt-2 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatBRL(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Entrega</span>
                      <span>{(order.delivery_fee || 0) > 0 ? formatBRL(order.delivery_fee!) : 'Grátis'}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-sm">Total</span>
                      <span className="text-lg text-primary">{formatBRL(order.total)}</span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 pt-1">
                    {order.status !== 'delivered' && (
                      <Button
                        size="sm"
                        variant={order.status === 'pending' ? 'default' : 'secondary'}
                        onClick={() => updateStatus(order, order.status)}
                        className="flex-1"
                      >
                        {order.status === 'pending' && (
                          <>
                            {printerConfig.connection !== 'none' && !printerConfig.autoprint && <Printer className="h-3.5 w-3.5 mr-1" />}
                            Iniciar Preparo
                          </>
                        )}
                        {order.status === 'preparing' && 'Sair p/ Entrega'}
                        {order.status === 'out_for_delivery' && 'Marcar Entregue'}
                      </Button>
                    )}
                    {/* Botão imprimir manual sempre disponível */}
                    {printerConfig.connection !== 'none' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintOrder(order)}
                        className="shrink-0"
                        title="Imprimir pedido"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
