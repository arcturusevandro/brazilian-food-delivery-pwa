import { useState, useEffect, useCallback } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Skeleton, Input, Label } from '@blinkdotnew/ui'
import { Clock, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
  status: string
  total: number
  notes: string | null
  created_at: string
  items?: OrderItem[]
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function OrderHistory({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })

    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

    const { data, error } = await query
    if (!error && data) setOrders(data as Order[])
    setLoading(false)
  }, [restaurantId, dateFrom, dateTo])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">De</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-40" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>Limpar</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-semibold">Nenhum pedido finalizado</h3>
          <p className="text-sm text-muted-foreground mt-1">Os pedidos entregues aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{orders.length} pedido(s) encontrado(s)</p>
          {orders.map(order => (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{order.customer_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('pt-BR')} · {formatTime(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">{formatBRL(order.total)}</span>
                    <Badge variant="default" className="ml-2 gap-1 text-xs">
                      <CheckCircle className="h-3 w-3" /> Entregue
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {order.customer_phone && <span>📞 {order.customer_phone}</span>}
                  <span>📍 {order.address}</span>
                  <span>💳 {order.payment_method}</span>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <ul className="space-y-0.5 text-sm">
                      {order.items.map(item => (
                        <li key={item.id} className="flex justify-between">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span className="text-muted-foreground">{formatBRL(item.unit_price * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
