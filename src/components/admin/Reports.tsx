import { useState, useEffect, useCallback } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Skeleton, Badge } from '@blinkdotnew/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, ShoppingBag, DollarSign, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ReportData {
  totalRevenue: number
  totalOrders: number
  averageTicket: number
  revenueByPeriod: { label: string; value: number }[]
  topProducts: { name: string; quantity: number; rank: number }[]
}

type Period = 'day' | 'week' | 'month' | 'year'

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Hoje',
  week: 'Esta semana',
  month: 'Este mês',
  year: 'Este ano',
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString()
  let start: Date

  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      const dayOfWeek = now.getDay()
      start = new Date(now)
      start.setDate(now.getDate() - dayOfWeek)
      start.setHours(0, 0, 0, 0)
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'year':
      start = new Date(now.getFullYear(), 0, 1)
      break
  }

  return { start: start.toISOString(), end }
}

export function Reports({ restaurantId }: { restaurantId: string }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange(period)

      // Pedidos entregues no período
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'delivered')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true })

      if (error) throw error

      const totalRevenue = orders.reduce((sum: number, o: any) => sum + o.total, 0)
      const totalOrders = orders.length
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Agrupa receita por período para o gráfico
      const revenueMap = new Map<string, number>()
      for (const order of orders) {
        const date = new Date(order.created_at)
        let label: string
        if (period === 'day') {
          label = `${date.getHours()}h`
        } else if (period === 'week') {
          const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          label = days[date.getDay()]
        } else if (period === 'month') {
          label = `${date.getDate()}/${date.getMonth() + 1}`
        } else {
          const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
          label = months[date.getMonth()]
        }
        revenueMap.set(label, (revenueMap.get(label) || 0) + order.total)
      }

      const revenueByPeriod = Array.from(revenueMap.entries()).map(([label, value]) => ({ label, value }))

      // Ranking de produtos (top 20)
      const productMap = new Map<string, number>()
      for (const order of orders) {
        for (const item of (order.items || [])) {
          const key = item.product_name
          productMap.set(key, (productMap.get(key) || 0) + item.quantity)
        }
      }

      const topProducts = Array.from(productMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, quantity], index) => ({ name, quantity, rank: index + 1 }))

      setData({ totalRevenue, totalOrders, averageTicket, revenueByPeriod, topProducts })
    } catch (err) {
      console.error('Erro ao carregar relatório:', err)
    } finally {
      setLoading(false)
    }
  }, [restaurantId, period])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? 'default' : 'outline'}
            onClick={() => setPeriod(p)}
            className="h-8 text-xs"
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita total</p>
                <p className="text-lg font-bold text-foreground">{formatBRL(data?.totalRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de pedidos</p>
                <p className="text-lg font-bold text-foreground">{data?.totalOrders || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket médio</p>
                <p className="text-lg font-bold text-foreground">{formatBRL(data?.averageTicket || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de receita */}
      {data && data.revenueByPeriod.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receita por período</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.revenueByPeriod} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${v}`} />
                <Tooltip
                  formatter={(value: number) => [formatBRL(value), 'Receita']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ranking top 20 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Ranking de produtos mais vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum pedido entregue no período selecionado.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topProducts.map(product => (
                <div key={product.name} className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                    product.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                    product.rank === 2 ? 'bg-gray-100 text-gray-600' :
                    product.rank === 3 ? 'bg-orange-100 text-orange-600' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {product.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {product.quantity} vendido{product.quantity !== 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
