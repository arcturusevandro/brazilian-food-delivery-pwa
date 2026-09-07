import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Package,
  Clock,
  MapPin,
  Phone,
  CreditCard,
  ChefHat,
  Bike,
  CheckCircle,
  Volume2,
  VolumeX,
  Printer,
  Bell,
  BellOff,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  requestFirebaseNotificationToken,
} from '@/lib/firebase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  printOrder,
  PrinterConfig,
} from '@/lib/usePrinter'

type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'

type PushNotificationStatus =
  | 'checking'
  | 'unsupported'
  | 'default'
  | 'denied'
  | 'active'

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
  items: OrderItem[]
}

interface OrdersDashboardProps {
  restaurantId: string
}

interface RegisterPushTokenResponse {
  success?: boolean
  message?: string
  error?: string
}

const STATUS_MAP: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', variant: 'destructive', icon: <Clock className="h-3.5 w-3.5" /> },
  preparing: { label: 'Preparando', variant: 'secondary', icon: <ChefHat className="h-3.5 w-3.5" /> },
  out_for_delivery: { label: 'Saiu p/ Entrega', variant: 'outline', icon: <Bike className="h-3.5 w-3.5" /> },
  delivered: { label: 'Entregue', variant: 'default', icon: <CheckCircle className="h-3.5 w-3.5" /> },
}

const STATUS_NEXT: Record<OrderStatus, OrderStatus | null> = {
  pending: 'preparing', preparing: 'out_for_delivery', out_for_delivery: 'delivered', delivered: null,
}

const PAYMENT_LABEL: Record<string, string> = { cash: 'Dinheiro', card: 'Cartão', pix: 'Pix' }
const SOUND_STORAGE_PREFIX = 'orders_sound_enabled'
const PUSH_STORAGE_PREFIX = 'orders_push_enabled'
const RINGTONE_PATH = '/audio/new-order-ring.mp3'

function getSoundStorageKey(restaurantId: string): string { return `${SOUND_STORAGE_PREFIX}_${restaurantId}` }
function getPushStorageKey(restaurantId: string): string { return `${PUSH_STORAGE_PREFIX}_${restaurantId}` }
function loadSoundPreference(restaurantId: string): boolean { try { return localStorage.getItem(getSoundStorageKey(restaurantId)) === 'true' } catch { return false } }
function saveSoundPreference(restaurantId: string, enabled: boolean): void { try { localStorage.setItem(getSoundStorageKey(restaurantId), enabled ? 'true' : 'false') } catch {} }
function loadPushPreference(restaurantId: string): boolean { try { return localStorage.getItem(getPushStorageKey(restaurantId)) === 'true' } catch { return false } }
function savePushPreference(restaurantId: string, enabled: boolean): void { try { localStorage.setItem(getPushStorageKey(restaurantId), enabled ? 'true' : 'false') } catch {} }
function getNotificationPermission(): NotificationPermission { return Notification.permission }

function getDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Dispositivo desconhecido'
  const userAgent = navigator.userAgent.toLowerCase()
  let device = 'Computador'
  if (userAgent.includes('android')) device = 'Celular Android'
  else if (userAgent.includes('iphone')) device = 'iPhone'
  else if (userAgent.includes('ipad')) device = 'iPad'
  else if (userAgent.includes('mobile')) device = 'Celular'
  let browser = 'Navegador'
  if (userAgent.includes('edg/')) browser = 'Edge'
  else if (userAgent.includes('chrome/')) browser = 'Chrome'
  else if (userAgent.includes('firefox/')) browser = 'Firefox'
  else if (userAgent.includes('safari/')) browser = 'Safari'
  return `${device} - ${browser}`
}

function getInitialPushStatus(restaurantId: string): PushNotificationStatus {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'checking'
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (getNotificationPermission() === 'denied') return 'denied'
  if (getNotificationPermission() === 'granted' && loadPushPreference(restaurantId)) return 'active'
  return 'default'
}

function formatBRL(value: number): string { return `R$ ${value.toFixed(2).replace('.', ',')}` }
function formatDateTime(iso: string): string { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

let ringerAudio: HTMLAudioElement | null = null
let ringerActive = false
let testTimeout: ReturnType<typeof setTimeout> | null = null

function getRingerAudio(): HTMLAudioElement {
  if (!ringerAudio) { ringerAudio = new Audio(RINGTONE_PATH); ringerAudio.preload = 'auto'; ringerAudio.loop = true; ringerAudio.volume = 1 }
  return ringerAudio
}
async function startRinger() { if (ringerActive) return; try { const audio = getRingerAudio(); if (testTimeout) { clearTimeout(testTimeout); testTimeout = null }; audio.pause(); audio.currentTime = 0; audio.loop = true; audio.volume = 1; ringerActive = true; await audio.play() } catch { ringerActive = false } }
function stopRinger() { ringerActive = false; if (testTimeout) { clearTimeout(testTimeout); testTimeout = null }; if (!ringerAudio) return; ringerAudio.pause(); ringerAudio.currentTime = 0; ringerAudio.loop = true }
async function testRing() { try { const audio = getRingerAudio(); if (testTimeout) clearTimeout(testTimeout); audio.pause(); audio.currentTime = 0; audio.loop = false; audio.volume = 1; await audio.play(); testTimeout = setTimeout(() => { audio.pause(); audio.currentTime = 0; audio.loop = true; testTimeout = null }, 3000) } catch {} }
async function unlockAudio() { try { if (ringerActive) return; const audio = getRingerAudio(); const oldVolume = audio.volume; const oldLoop = audio.loop; audio.volume = 0; audio.loop = false; audio.currentTime = 0; await audio.play(); audio.pause(); audio.currentTime = 0; audio.volume = oldVolume; audio.loop = oldLoop } catch {} }

function loadPrinterConfig(): PrinterConfig {
  try { const saved = localStorage.getItem('printer_config'); if (saved) return JSON.parse(saved) } catch {}
  return { connection: 'none', paperWidth: '80mm', autoprint: false }
}

export function OrdersDashboard({ restaurantId }: OrdersDashboardProps) {
  const initialSoundEnabled = loadSoundPreference(restaurantId)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled)
  const [isRinging, setIsRinging] = useState(false)
  const [pushStatus, setPushStatus] = useState<PushNotificationStatus>(() => getInitialPushStatus(restaurantId))
  const [activatingPush, setActivatingPush] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const soundEnabledRef = useRef(initialSoundEnabled)
  const printerConfigRef = useRef<PrinterConfig>(loadPrinterConfig())

  useEffect(() => { const enabled = loadSoundPreference(restaurantId); soundEnabledRef.current = enabled; setSoundEnabled(enabled) }, [restaurantId])
  useEffect(() => { setPushStatus(getInitialPushStatus(restaurantId)) }, [restaurantId])
  useEffect(() => {
    if (!soundEnabled) return
    let unlocked = false
    const handleInteraction = () => { if (unlocked) return; unlocked = true; void unlockAudio() }
    window.addEventListener('pointerdown', handleInteraction); window.addEventListener('keydown', handleInteraction)
    return () => { window.removeEventListener('pointerdown', handleInteraction); window.removeEventListener('keydown', handleInteraction) }
  }, [soundEnabled])
  useEffect(() => { const handler = () => { printerConfigRef.current = loadPrinterConfig() }; window.addEventListener('storage', handler); return () => window.removeEventListener('storage', handler) }, [])

  const handleStopRinging = useCallback(() => { stopRinger(); setIsRinging(false) }, [])
  const handleStartRinging = useCallback(() => { if (!soundEnabledRef.current || ringerActive) return; void startRinger().then(() => { if (ringerActive) setIsRinging(true) }) }, [])

  const handleEnablePushNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') { toast.error('Notificações não estão disponíveis neste dispositivo.'); return }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) { setPushStatus('unsupported'); toast.error('Este navegador não suporta notificações push.'); return }
    if (getNotificationPermission() === 'denied') { setPushStatus('denied'); toast.error('As notificações estão bloqueadas. Libere nas configurações do navegador.'); return }
    setActivatingPush(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) throw new Error('Sua sessão expirou. Entre novamente no painel.')
      const token = await requestFirebaseNotificationToken()
      if (!token) { if (getNotificationPermission() === 'denied') { setPushStatus('denied'); throw new Error('As notificações foram bloqueadas no navegador.') }; throw new Error('Não foi possível gerar o token de notificações.') }
      const { data, error } = await supabase.functions.invoke<RegisterPushTokenResponse>('register-push-token', { body: { restaurantId, token, deviceName: getDeviceName(), userAgent: navigator.userAgent } })
      if (error) throw new Error(error.message || 'Erro ao cadastrar o aparelho.')
      if (!data || data.success !== true) throw new Error(data?.error || 'Não foi possível ativar as notificações.')
      savePushPreference(restaurantId, true); setPushStatus('active'); toast.success(data.message || 'Notificações ativadas neste aparelho.')
    } catch (error) { const message = error instanceof Error ? error.message : 'Erro ao ativar notificações.'; toast.error(message); if (typeof Notification !== 'undefined' && getNotificationPermission() === 'denied') setPushStatus('denied') }
    finally { setActivatingPush(false) }
  }, [restaurantId])

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data: orderData, error: orderError } = await supabase.from('orders').select('*').eq('restaurant_id', restaurantId).in('status', ['pending','preparing','out_for_delivery']).order('created_at', { ascending: false })
      if (orderError) throw orderError
      const ids = (orderData || []).map((o: Omit<Order, 'items'>) => o.id)
      let items: OrderItem[] = []
      if (ids.length > 0) { const { data: itemData } = await supabase.from('order_items').select('*').in('order_id', ids); items = itemData || [] }
      const enriched: Order[] = (orderData || []).map((o: Omit<Order, 'items'>) => ({ ...o, items: items.filter(i => i.order_id === o.id) }))
      if (silent && prevIdsRef.current.size > 0) {
        const newOrders = enriched.filter((o) => !prevIdsRef.current.has(o.id) && o.status === 'pending')
        if (newOrders.length > 0) {
          if (soundEnabledRef.current) handleStartRinging()
          const cfg = printerConfigRef.current
          if (cfg.autoprint && cfg.connection !== 'none') for (const o of newOrders) void printOrder(o, cfg)
        }
      }
      prevIdsRef.current = new Set(enriched.map((o) => o.id)); setOrders(enriched); setLastUpdate(new Date())
    } catch (err) { console.error(err); if (!silent) toast.error('Erro ao carregar pedidos') }
    finally { if (!silent) setLoading(false) }
  }, [restaurantId, handleStartRinging])

  useEffect(() => {
    fetchOrders()
    const channel = supabase.channel(`orders-${restaurantId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => { fetchOrders(true) }).subscribe()
    const interval = setInterval(() => fetchOrders(true), 30000)
    return () => { supabase.removeChannel(channel); clearInterval(interval); stopRinger() }
  }, [restaurantId, fetchOrders])

  const updateStatus = async (order: Order) => {
    const next = STATUS_NEXT[order.status]; if (!next) return
    if (order.status === 'pending') handleStopRinging()
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id)
    if (error) toast.error('Erro ao atualizar pedido'); else { toast.success(`Pedido marcado como ${STATUS_MAP[next].label}`); fetchOrders(true) }
  }

  const handleSoundToggle = () => { const next = !soundEnabled; setSoundEnabled(next); soundEnabledRef.current = next; saveSoundPreference(restaurantId, next); if (!next) handleStopRinging(); else { void unlockAudio(); toast.success('Som de novos pedidos ativado!') } }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>

  return (
    <div className="space-y-5" ref={scrollRef}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold">Pedidos em andamento</h2><p className="text-xs text-muted-foreground">Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleSoundToggle}>{soundEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}{soundEnabled ? 'Som ligado' : 'Som desligado'}</Button>
          {soundEnabled && <Button variant="outline" size="sm" onClick={() => void testRing()}><Bell className="mr-2 h-4 w-4" />Testar som</Button>}
          <Button variant="outline" size="sm" disabled={activatingPush || pushStatus === 'unsupported' || pushStatus === 'denied'} onClick={() => void handleEnablePushNotifications()}>
            {activatingPush ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : pushStatus === 'active' ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
            {pushStatus === 'active' ? 'Push ativo' : pushStatus === 'denied' ? 'Push bloqueado' : pushStatus === 'unsupported' ? 'Push indisponível' : 'Ativar push'}
          </Button>
        </div>
      </div>

      {isRinging && <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"><div className="flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4 animate-pulse" />Novo pedido recebido</div><Button variant="destructive" size="sm" onClick={handleStopRinging}>Parar campainha</Button></div>}

      {orders.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12 text-center"><Package className="mb-3 h-10 w-10 text-muted-foreground/50" /><p className="font-medium">Nenhum pedido em andamento</p><p className="text-sm text-muted-foreground">Novos pedidos aparecerão aqui automaticamente.</p></CardContent></Card>
      ) : orders.map(order => {
        const next = STATUS_NEXT[order.status]
        return (
          <Card key={order.id} className={cn(order.status === 'pending' && 'border-destructive/50')}>
            <CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{order.customer_name}</CardTitle><p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p></div><Badge variant={STATUS_MAP[order.status].variant} className="gap-1">{STATUS_MAP[order.status].icon}{STATUS_MAP[order.status].label}</Badge></div></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{order.customer_phone}</span></div>
                <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{order.address}{order.neighborhood ? ` — ${order.neighborhood}` : ''}</span></div>
                <div className="flex gap-2"><CreditCard className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{PAYMENT_LABEL[order.payment_method] || order.payment_method}</span></div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3"><div className="space-y-1.5">{order.items.map(item => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.quantity}× {item.product_name}</span><span>{formatBRL(item.quantity * item.unit_price)}</span></div>)}</div><div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold"><span>Total</span><span>{formatBRL(order.total)}</span></div></div>
              {order.notes && <p className="rounded-md bg-accent px-3 py-2 text-sm"><strong>Observação:</strong> {order.notes}</p>}
              <div className="flex flex-wrap gap-2">
                {next && <Button onClick={() => void updateStatus(order)}>{STATUS_MAP[next].icon}<span className="ml-2">Marcar como {STATUS_MAP[next].label}</span></Button>}
                <Button variant="outline" onClick={() => void printOrder(order, printerConfigRef.current)}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
