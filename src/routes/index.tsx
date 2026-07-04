import { createFileRoute } from '@tanstack/react-router'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Sabor Express — Cardápio' },
      { name: 'description', content: 'Peça sua comida brasileira favorita no Sabor Express. Cardápio online com delivery rápido.' },
      { name: 'theme-color', content: '#F97316' },
      { property: 'og:title', content: 'Sabor Express — Cardápio' },
      { property: 'og:description', content: 'Peça sua comida brasileira favorita. Delivery rápido e fácil.' },
    ],
  }),
  component: MenuPage,
})

function MenuPage() {
  return (
    <BlinkClientBoundary fallback={<LoadingShell />}>
      <PWARegister />
      <MenuShell />
    </BlinkClientBoundary>
  )
}

function PWARegister() {
  useEffect(() => {
    import('@/lib/pwa').then((m) => m.registerSW())
  }, [])
  return null
}

function LoadingShell() {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <div className="h-12 w-48 rounded-xl bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
    </div>
  )
}

// ── Shell: fetches data, owns cart state, renders everything ──

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Badge, toast } from '@blinkdotnew/ui'
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  Clock,
  MapPin,
  UtensilsCrossed,
  ChefHat,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'

// ── Types ──

interface Restaurant {
  id: string
  name: string
  slug: string
  logo_url: string | null
  phone: string | null
  address: string | null
  is_open: boolean
}

interface Category {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
}

interface Product {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  photo_url: string | null
  available: boolean
}

interface CartItem {
  product: Product
  quantity: number
}

type PaymentMethod = 'cash' | 'card'

interface CheckoutForm {
  customer_name: string
  customer_phone: string
  address: string
  payment_method: PaymentMethod
  notes: string
}

// ── Price formatter ──

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

// ── Food emoji placeholders ──

const FOOD_EMOJIS = ['🍽️', '🍛', '🥘', '🍲', '🥗', '🍝', '🥩', '🍗', '🧆', '🌮', '🍜', '🍱', '🥟', '🍔', '🍕', '🥪', '🍳', '🧀', '🍟', '🌯']

function getFoodEmoji(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return FOOD_EMOJIS[Math.abs(hash) % FOOD_EMOJIS.length]
}

// ── Main Component ──

function MenuShell() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch all data ──
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const { data: restaurantData, error: restaurantError } = await supabase
          .from('restaurants')
          .select('*')
          .limit(1)
          .maybeSingle()

        if (restaurantError) throw restaurantError
        if (!restaurantData) {
          setRestaurant(null)
          setLoading(false)
          return
        }

        setRestaurant(restaurantData)

        const [{ data: catData, error: catError }, { data: prodData, error: prodError }] =
          await Promise.all([
            supabase.from('categories').select('*').eq('restaurant_id', restaurantData.id).order('sort_order'),
            supabase.from('products').select('*').eq('restaurant_id', restaurantData.id).eq('available', true),
          ])

        if (catError) throw catError
        if (prodError) throw prodError

        setCategories(catData || [])
        setProducts(prodData || [])
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar o cardápio')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // ── Cart operations ──
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    toast.success(`${product.name} adicionado`)
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === productId)
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
      }
      return prev.filter((item) => item.product.id !== productId)
    })
  }, [])

  const removeItemCompletely = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }, [])

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  )

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )

  // ── Submit order ──
  const submitOrder = useCallback(
    async (form: CheckoutForm) => {
      if (!restaurant) return
      if (cart.length === 0) {
        toast.error('Seu carrinho está vazio')
        return
      }

      setSubmitting(true)
      try {
        const total = cartTotal

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            restaurant_id: restaurant.id,
            customer_name: form.customer_name,
            customer_phone: form.customer_phone,
            address: form.address,
            payment_method: form.payment_method,
            status: 'pending',
            total,
            notes: form.notes || null,
          })
          .select('id')
          .single()

        if (orderError) throw orderError

        const orderItems = cart.map((item) => ({
          order_id: orderData.id,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.price,
        }))

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
        if (itemsError) throw itemsError

        toast.success('Pedido realizado com sucesso! 🎉', {
          description: 'Seu pedido foi recebido e será preparado em breve.',
        })

        setCart([])
        setCheckoutOpen(false)
      } catch (err: any) {
        toast.error('Erro ao fazer pedido', {
          description: err.message || 'Tente novamente.',
        })
      } finally {
        setSubmitting(false)
      }
    },
    [restaurant, cart, cartTotal]
  )

  // ── Group products by category ──
  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const cat of categories) {
      const catProducts = products.filter((p) => p.category_id === cat.id)
      if (catProducts.length > 0) {
        map.set(cat.id, catProducts)
      }
    }
    return map
  }, [categories, products])

  // Uncategorized products
  const uncategorizedProducts = useMemo(
    () => products.filter((p) => !categories.some((c) => c.id === p.category_id)),
    [products, categories]
  )

  // ── Loading state ──
  if (loading) return <LoadingShell />

  // ── Error / Empty state ──
  if (error) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Erro ao carregar</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <UtensilsCrossed className="h-16 w-16 text-muted-foreground/40" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">Em breve!</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            Nosso cardápio está sendo preparado. Volte logo para conferir nossas delícias!
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-dvh bg-background pb-24">
        {/* ── Restaurant Header ── */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shadow-md">
                {restaurant.logo_url ? (
                  <img
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <ChefHat className="h-6 w-6" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-foreground truncate">{restaurant.name}</h1>
                <div className="flex items-center gap-2 mt-0.5 text-sm">
                  <Badge
                    variant={restaurant.is_open ? 'default' : 'destructive'}
                    className="gap-1 text-xs"
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        restaurant.is_open ? 'bg-primary-foreground' : 'bg-destructive-foreground'
                      }`}
                    />
                    {restaurant.is_open ? 'Aberto' : 'Fechado'}
                  </Badge>
                  {restaurant.is_open && (
                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Aceitando pedidos
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Menu Content ── */}
        <main className="mx-auto max-w-3xl px-4 py-6">
          {/* Categories + Products */}
          {categories.length === 0 && products.length === 0 ? (
            <EmptyMenu />
          ) : (
            <div className="space-y-8">
              {/* Products grouped by category */}
              {categories.map((cat) => {
                const catProducts = productsByCategory.get(cat.id)
                if (!catProducts || catProducts.length === 0) return null

                return (
                  <section key={cat.id} id={`cat-${cat.id}`}>
                    <div className="sticky top-[73px] z-20 bg-background/95 backdrop-blur-sm py-3 mb-3">
                      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-primary" />
                        {cat.name}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {catProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          cartItem={cart.find((i) => i.product.id === product.id)}
                          restaurantOpen={restaurant.is_open}
                          onAdd={addToCart}
                          onRemove={removeFromCart}
                          onAddMore={addToCart}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}

              {/* Uncategorized products */}
              {uncategorizedProducts.length > 0 && (
                <section>
                  <div className="sticky top-[73px] z-20 bg-background/95 backdrop-blur-sm py-3 mb-3">
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 text-primary" />
                      Mais itens
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {uncategorizedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        cartItem={cart.find((i) => i.product.id === product.id)}
                        restaurantOpen={restaurant.is_open}
                        onAdd={addToCart}
                        onRemove={removeFromCart}
                        onAddMore={addToCart}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Only categories with no products */}
              {productsByCategory.size === 0 && uncategorizedProducts.length === 0 && categories.length > 0 && (
                <EmptyMenu />
              )}
            </div>
          )}
        </main>

        {/* ── Barra de Checkout Fixa (padrão delivery) ── */}
        {cart.length > 0 && !checkoutOpen && (
          <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-xl active:scale-[0.98] transition-all duration-150"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20 font-bold text-sm">
                  {cartItemCount}
                </div>
                <span className="font-semibold text-sm">Ver carrinho</span>
              </div>
              <span className="font-bold text-base">{formatBRL(cartTotal)}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Cart Slide-up Panel ── */}
      {cartOpen && (
        <CartPanel
          cart={cart}
          cartTotal={cartTotal}
          cartItemCount={cartItemCount}
          restaurantName={restaurant.name}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onRemoveAll={removeItemCompletely}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false)
            setCheckoutOpen(true)
          }}
        />
      )}

      {/* ── Checkout Slide-up Panel ── */}
      {checkoutOpen && (
        <CheckoutPanel
          cart={cart}
          cartTotal={cartTotal}
          cartItemCount={cartItemCount}
          restaurantName={restaurant.name}
          submitting={submitting}
          onSubmit={submitOrder}
          onClose={() => setCheckoutOpen(false)}
          onBack={() => {
            setCheckoutOpen(false)
            setCartOpen(true)
          }}
        />
      )}
    </>
  )
}

// ── Product Card ──

function ProductCard({
  product,
  cartItem,
  restaurantOpen,
  onAdd,
  onRemove,
  onAddMore,
}: {
  product: Product
  cartItem: CartItem | undefined
  restaurantOpen: boolean
  onAdd: (p: Product) => void
  onRemove: (productId: string) => void
  onAddMore: (p: Product) => void
}) {
  const quantity = cartItem?.quantity ?? 0
  const emoji = getFoodEmoji(product.name)

  return (
    <div
      className="group relative flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in"
    >
      {/* Product photo / placeholder */}
      <div className="flex-shrink-0 h-20 w-20 rounded-lg bg-accent flex items-center justify-center overflow-hidden">
        {product.photo_url ? (
          <img
            src={product.photo_url}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-3xl">{emoji}</span>
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground leading-tight">{product.name}</h3>
        {product.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
        )}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{formatBRL(product.price)}</span>

          {restaurantOpen ? (
            quantity > 0 ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onRemove(product.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-150"
                  aria-label="Remover um"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-foreground">{quantity}</span>
                <button
                  onClick={() => onAddMore(product)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 active:scale-90"
                  aria-label="Adicionar um"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onAdd(product)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 active:scale-90"
                aria-label="Adicionar ao carrinho"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )
          ) : (
            <Badge variant="destructive" className="text-xs">Indisponível</Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Empty Menu State ──

function EmptyMenu() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent mb-4">
        <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">Cardápio vazio</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        Nenhum item disponível no momento. Volte mais tarde!
      </p>
    </div>
  )
}

// ── Cart Panel (slide-up) ──

function CartPanel({
  cart,
  cartTotal,
  cartItemCount,
  restaurantName,
  onAdd,
  onRemove,
  onRemoveAll,
  onClose,
  onCheckout,
}: {
  cart: CartItem[]
  cartTotal: number
  cartItemCount: number
  restaurantName: string
  onAdd: (p: Product) => void
  onRemove: (productId: string) => void
  onRemoveAll: (productId: string) => void
  onClose: () => void
  onCheckout: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex flex-col max-h-[80dvh] rounded-t-2xl bg-card shadow-2xl animate-slide-up border-t border-border">
        {/* Handle + Header */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Seu carrinho</h2>
              <p className="text-xs text-muted-foreground">
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'} · {restaurantName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors"
              aria-label="Fechar carrinho"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-lg">
                {getFoodEmoji(item.product.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">{formatBRL(item.product.price)} cada</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => item.quantity <= 1 ? onRemoveAll(item.product.id) : onRemove(item.product.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label="Remover"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  onClick={() => onAdd(item.product)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-90"
                  aria-label="Adicionar"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <span className="text-sm font-semibold text-foreground w-16 text-right">
                {formatBRL(item.product.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-4 py-3 space-y-3 bg-card rounded-b-2xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">{formatBRL(cartTotal)}</span>
          </div>
          <Button onClick={onCheckout} className="w-full h-12 text-base font-semibold gap-2">
            <ShoppingBag className="h-5 w-5" />
            Ir para o checkout
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Checkout Panel (slide-up form) ──

function CheckoutPanel({
  cart,
  cartTotal,
  cartItemCount,
  restaurantName,
  submitting,
  onSubmit,
  onClose,
  onBack,
}: {
  cart: CartItem[]
  cartTotal: number
  cartItemCount: number
  restaurantName: string
  submitting: boolean
  onSubmit: (form: CheckoutForm) => void
  onClose: () => void
  onBack: () => void
}) {
  const [form, setForm] = useState<CheckoutForm>({
    customer_name: '',
    customer_phone: '',
    address: '',
    payment_method: 'cash',
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({})

  const validate = (): boolean => {
    const next: Partial<Record<keyof CheckoutForm, string>> = {}
    if (!form.customer_name.trim()) next.customer_name = 'Nome é obrigatório'
    if (!form.customer_phone.trim()) next.customer_phone = 'Telefone é obrigatório'
    if (!form.address.trim()) next.address = 'Endereço é obrigatório'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex flex-col max-h-[90dvh] rounded-t-2xl bg-card shadow-2xl animate-slide-up border-t border-border">
        {/* Handle + Header */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors"
                aria-label="Voltar ao carrinho"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Checkout</h2>
                <p className="text-xs text-muted-foreground">{cartItemCount} itens · {formatBRL(cartTotal)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Order summary */}
          <div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Resumo do pedido</p>
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate flex-1 mr-2">
                  {item.quantity}x {item.product.name}
                </span>
                <span className="text-muted-foreground flex-shrink-0">{formatBRL(item.product.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-sm font-bold text-primary">{formatBRL(cartTotal)}</span>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome *</label>
            <Input
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              placeholder="Seu nome completo"
              className={errors.customer_name ? 'border-destructive' : ''}
            />
            {errors.customer_name && (
              <p className="text-xs text-destructive">{errors.customer_name}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Telefone *</label>
            <Input
              value={form.customer_phone}
              onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
              placeholder="(11) 99999-9999"
              type="tel"
              className={errors.customer_phone ? 'border-destructive' : ''}
            />
            {errors.customer_phone && (
              <p className="text-xs text-destructive">{errors.customer_phone}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Endereço de entrega *</label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Rua, número, bairro"
              className={errors.address ? 'border-destructive' : ''}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address}</p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Forma de pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, payment_method: 'cash' }))}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                  form.payment_method === 'cash'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span className="text-lg">💵</span>
                Dinheiro
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, payment_method: 'card' }))}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                  form.payment_method === 'card'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span className="text-lg">💳</span>
                Cartão
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Observações</label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Ex: sem cebola, troco para R$ 50..."
            />
          </div>

          {/* Delivery info */}
          <div className="rounded-lg bg-accent px-3 py-2.5 flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-accent-foreground">
              Entrega em aproximadamente 40-60 minutos. Pedidos feitos após as 22h serão entregues no dia seguinte.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-card rounded-b-2xl">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-12 text-base font-semibold"
          >
            {submitting ? 'Enviando pedido...' : `Confirmar pedido · ${formatBRL(cartTotal)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
