import { useState, useEffect, useRef } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Skeleton } from '@blinkdotnew/ui'
import { Package, Clock, MapPin, Phone, CreditCard, ChefHat, Bike, CheckCircle } from 'lucide-react'
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

export function OrdersDashboard({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'delivered')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setOrders(data as Order[])
        prevCountRef.current = data.length
      }
      setLoading(false)
    }
    fetchOrders()
  }, [restaurantId])

  useEffect(() => {
    const channel = supabase
      .channel('orders-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        async () => {
          const { data } = await supabase
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('restaurant_id', restaurantId)
            .neq('status', 'delivered')
            .order('created_at', { ascending: false })

          if (data) {
            const isNewOrder = data.length > prevCountRef.current
            prevCountRef.current = data.length
            setOrders(data as Order[])
            if (isNewOrder) {
              toast.success('Novo pedido recebido! 🎉')
              scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  const updateStatus = async (orderId: string, currentStatus: OrderStatus) => {
    const next = STATUS_NEXT[currentStatus]
    if (!next) return

    const { error } = await supabase.from('orders').update({ status: next }).eq('id', orderId)
    if (error) {
      toast.error('Erro ao atualizar status')
    } else {
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: next } : o)))
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

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold">Nenhum pedido ativo</h3>
        <p className="text-sm text-muted-foreground mt-1">Os novos pedidos aparecerão aqui em tempo real.</p>
      </div>
    )
  }

  return (
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
  )
}
