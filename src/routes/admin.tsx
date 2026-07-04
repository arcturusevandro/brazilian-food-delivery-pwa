import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { useRestaurant } from '@/hooks/useRestaurant'
import { supabase } from '@/lib/supabase'
import { Button, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent, Input, Card, CardHeader, CardTitle, CardContent, Label } from '@blinkdotnew/ui'
import { LogOut, Package, Pencil, Clock } from 'lucide-react'
import { LoginForm } from '@/components/admin/LoginForm'
import { OrdersDashboard } from '@/components/admin/OrdersDashboard'
import { MenuManager } from '@/components/admin/MenuManager'
import { OrderHistory } from '@/components/admin/OrderHistory'
import toast, { Toaster as HotToaster } from 'react-hot-toast'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Admin · Sabor Express' },
      { name: 'description', content: 'Painel administrativo do Sabor Express' },
    ],
  }),
  component: AdminPage,
})

function AdminPage() {
  return (
    <BlinkClientBoundary fallback={<AdminSkeleton />}>
      <HotToaster position="top-right" toastOptions={{ duration: 3000 }} />
      <AdminContent />
    </BlinkClientBoundary>
  )
}

function AdminSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="space-y-4 w-full max-w-sm">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

// Tela para criar restaurante após primeiro login
function CreateRestaurantForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const { createRestaurant } = useRestaurant()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Sessão inválida')
      const result = await createRestaurant(session.user, name.trim())
      if (result) {
        toast.success('Restaurante criado com sucesso!')
        onCreated()
      } else {
        toast.error('Erro ao criar restaurante. Tente novamente.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar restaurante')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-orange-50 to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
            SE
          </div>
          <CardTitle className="text-xl">Criar seu Restaurante</CardTitle>
          <p className="text-sm text-muted-foreground">
            Dê um nome ao seu restaurante para começar
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
              <Input
                id="restaurant-name"
                placeholder="Ex: Rei do Hamburguer"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading ? 'Criando...' : 'Criar Restaurante'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminContent() {
  const [session, setSession] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const { restaurant, loading: restaurantLoading, refetch } = useRestaurant()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Até logo!')
  }

  const handleAuthSuccess = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) refetch(data.session.user)
  }, [refetch])

  const handleRestaurantCreated = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) refetch(data.session.user)
  }, [refetch])

  if (!authChecked || restaurantLoading) return <AdminSkeleton />

  // Não logado
  if (!session) return <LoginForm onSuccess={handleAuthSuccess} />

  // Logado mas sem restaurante → criar restaurante
  if (!restaurant) return <CreateRestaurantForm onCreated={handleRestaurantCreated} />

  // Logado e com restaurante → painel completo
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">SE</div>
            <div>
              <h1 className="text-sm font-semibold">{restaurant.name}</h1>
              <p className="text-xs text-muted-foreground">Painel Administrativo</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="orders">
          <TabsList className="w-full justify-start gap-1 overflow-x-auto border-b border-border rounded-none bg-transparent p-0 h-auto">
            <TabsTrigger value="orders" className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <Package className="h-4 w-4" /> Pedidos
            </TabsTrigger>
            <TabsTrigger value="menu" className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <Pencil className="h-4 w-4" /> Cardápio
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <Clock className="h-4 w-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-6">
            <OrdersDashboard restaurantId={restaurant.id} />
          </TabsContent>

          <TabsContent value="menu" className="mt-6">
            <MenuManager restaurantId={restaurant.id} />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <OrderHistory restaurantId={restaurant.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
