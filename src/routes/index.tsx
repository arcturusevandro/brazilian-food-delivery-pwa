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

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Badge } from '@blinkdotnew/ui'
import {
  ShoppingBag, Plus, Minus, X, Clock, MapPin, UtensilsCrossed, ChefHat, AlertCircle, ArrowLeft,
} from 'lucide-react'

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

interface Addon {
  id: string
  product_id: string
  name: string
  price: number
  available: boolean
}

interface CartItem {
  cartId: string
  product: Product
  quantity: number
  addons: Addon[]
}

type PaymentMethod = 'cash' | 'card' | 'pix'

interface CheckoutForm {
  customer_name: string
  customer_phone: string
  address: string
  payment_method: PaymentMethod
  change_for: string
  notes: string
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

const FOOD_EMOJIS = ['🍽️', '🍛', '🥘', '🍲', '🥗', '🍝', '🥩', '🍗', '🧆', '🌮', '🍜', '🍱', '🥟', '🍔', '🍕', '🥪', '🍳', '🧀', '🍟', '🌯']

function getFoodEmoji(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return FOOD_EMOJIS[Math.abs(hash) % FOOD_EMOJIS.length]
}

// Calcula preço de um item incluindo adicionais
function itemUnitPrice(item: CartItem): number {
  const addonsTotal = item.addons.reduce((sum, a) => sum + a.price, 0)
  return item.product.price + addonsTotal
}

function MenuShell() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [addonsByProduct, setAddonsByProduct] = useState<Map<string, Addon[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Produto selecionado para escolher adicionais
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const { data: restaurantData, error: restaurantError } = await supabase
          .from('restaurants').select('*').limit(1).maybeSingle()

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

        // Busca adicionais de todos os produtos
        const productIds = (prodData || []).map((p) => p.id)
        if (productIds.length > 0) {
          const { data: addonData } = await supabase
            .from('product_addons')
            .select('*')
            .in('product_id', productIds)
            .eq('available', true)

          const map = new Map<string, Addon[]>()
          for (const addon of (addonData || [])) {
            const list = map.get(addon.product_id) || []
            list.push(addon)
            map.set(addon.product_id, list)
          }
          setAddonsByProduct(map)
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar o cardápio')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Adiciona produto SEM adicionais direto ao carrinho
  const addSimpleToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && item.addons.length === 0)
      if (existing) {
        return prev.map((item) =>
          item.cartId === existing.cartId ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { cartId: `${product.id}-${Date.now()}`, product, quantity: 1, addons: [] }]
    })
  }, [])

  // Adiciona produto COM adicionais escolhidos
  const addWithAddons = useCallback((product: Product, addons: Addon[]) => {
    setCart((prev) => [
      ...prev,
      { cartId: `${product.id}-${Date.now()}`, product, quantity: 1, addons },
    ])
  }, [])

  // Ao clicar no produto: se tem adicional abre detalhe, senão vai direto
  const handleProductClick = useCallback((product: Product) => {
    const productAddons = addonsByProduct.get(product.id) || []
    if (productAddons.length > 0) {
      setDetailProduct(product)
    } else {
      addSimpleToCart(product)
    }
  }, [addonsByProduct, addSimpleToCart])

  const incrementItem = useCallback((cartId: string) => {
    setCart((prev) => prev.map((item) => item.cartId === cartId ? { ...item, quantity: item.quantity + 1 } : item))
  }, [])

  const decrementItem = useCallback((cartId: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.cartId === cartId)
      if (item && item.quantity > 1) {
        return prev.map((i) => i.cartId === cartId ? { ...i, quantity: i.quantity - 1 } : i)
      }
      return prev.filter((i) => i.cartId !== cartId)
    })
  }, [])

  const removeItem = useCallback((cartId: string) => {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId))
  }, [])

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + itemUnitPrice(item) * item.quantity, 0),
    [cart]
  )

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )

  const submitOrder = useCallback(
    async (form: CheckoutForm) => {
      if (!restaurant) return
      if (cart.length === 0) return

      setSubmitting(true)
      try {
        const total = cartTotal

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          const { error: anonError } = await supabase.auth.signInAnonymously()
          if (anonError) throw anonError
        }

        let notesText = form.notes || ''
        if (form.payment_method === 'cash' && form.change_for.trim()) {
          const trocoInfo = `Troco para: R$ ${form.change_for}`
          notesText = notesText ? `${trocoInfo} | ${notesText}` : trocoInfo
        }

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
            notes: notesText || null,
          })
          .select('id')
          .single()

        if (orderError) throw orderError

        // Monta itens com adicionais no nome
        const orderItems = cart.map((item) => {
          let productName = item.product.name
          if (item.addons.length > 0) {
            const addonNames = item.addons.map((a) => a.name).join(', ')
            productName = `${item.product.name} (+ ${addonNames})`
          }
          return {
            order_id: orderData.id,
            product_id: item.product.id,
            product_name: productName,
            quantity: item.quantity,
            unit_price: itemUnitPrice(item),
          }
        })

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
        if (itemsError) throw itemsError

        setCart([])
        setCheckoutOpen(false)
        alert('✅ Pedido realizado com sucesso!\nSeu pedido foi recebido e será preparado em breve.')
      } catch (err: any) {
        alert(`Erro ao fazer pedido: ${err.message || 'Tente novamente.'}`)
      } finally {
        setSubmitting(false)
      }
    },
    [restaurant, cart, cartTotal]
  )

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const cat of categories) {
      const catProducts = products.filter((p) => p.category_id === cat.id)
      if (catProducts.length > 0) map.set(cat.id, catProducts)
    }
    return map
  }, [categories, products])

  const uncategorizedProducts = useMemo(
    () => products.filter((p) => !categories.some((c) => c.id === p.category_id)),
    [products, categories]
  )

  // Quantidade total de um produto no carrinho (todas variações)
  const productQtyInCart = useCallback((productId: string) => {
    return cart.filter((i) => i.product.id === productId).reduce((s, i) => s + i.quantity, 0)
  }, [cart])

  if (loading) return <LoadingShell />

  if (error) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Erro ao carregar</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <UtensilsCrossed className="h-16 w-16 text-muted-foreground/40" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">Em breve!</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">Nosso cardápio está sendo preparado. Volte logo para conferir nossas delícias!</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-dvh bg-background pb-28">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shadow-md">
                {restaurant.logo_url ? (
                  <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full rounded-xl object-cover" />
                ) : (
                  <ChefHat className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-foreground truncate">{restaurant.name}</h1>
                <div className="flex items-center gap-2 mt-0.5 text-sm">
                  <Badge variant={restaurant.is_open ? 'default' : 'destructive'} className="gap-1 text-xs">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${restaurant.is_open ? 'bg-primary-foreground' : 'bg-destructive-foreground'}`} />
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

        <main className="mx-auto max-w-3xl px-4 py-6">
          {categories.length === 0 && products.length === 0 ? (
            <EmptyMenu />
          ) : (
            <div className="space-y-8">
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
                          quantityInCart={productQtyInCart(product.id)}
                          hasAddons={(addonsByProduct.get(product.id) || []).length > 0}
                          restaurantOpen={restaurant.is_open}
                          onClick={() => handleProductClick(product)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}

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
                        quantityInCart={productQtyInCart(product.id)}
                        hasAddons={(addonsByProduct.get(product.id) || []).length > 0}
                        restaurantOpen={restaurant.is_open}
                        onClick={() => handleProductClick(product)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>

        {cart.length > 0 && !checkoutOpen && !detailProduct && (
          <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent">
            <button
              onClick={() => setCartOpen(true)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-xl active:scale-[0.98] transition-all duration-150"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20 font-bold text-sm">{cartItemCount}</div>
                <span className="font-semibold text-sm">Ver carrinho</span>
              </div>
              <span className="font-bold text-base">{formatBRL(cartTotal)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tela de detalhe do produto com adicionais */}
      {detailProduct && (
        <ProductDetailPanel
          product={detailProduct}
          addons={addonsByProduct.get(detailProduct.id) || []}
          onClose={() => setDetailProduct(null)}
          onConfirm={(addons) => {
            addWithAddons(detailProduct, addons)
            setDetailProduct(null)
          }}
        />
      )}

      {cartOpen && (
        <CartPanel
          cart={cart}
          cartTotal={cartTotal}
          cartItemCount={cartItemCount}
          restaurantName={restaurant.name}
          onIncrement={incrementItem}
          onDecrement={decrementItem}
          onRemove={removeItem}
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
        />
      )}

      {checkoutOpen && (
        <CheckoutPanel
          cart={cart}
          cartTotal={cartTotal}
          cartItemCount={cartItemCount}
          restaurantName={restaurant.name}
          submitting={submitting}
          onSubmit={submitOrder}
          onClose={() => setCheckoutOpen(false)}
          onBack={() => { setCheckoutOpen(false); setCartOpen(true) }}
        />
      )}
    </>
  )
}

// ── Product Card ──

function ProductCard({
  product, quantityInCart, hasAddons, restaurantOpen, onClick,
}: {
  product: Product
  quantityInCart: number
  hasAddons: boolean
  restaurantOpen: boolean
  onClick: () => void
}) {
  const emoji = getFoodEmoji(product.name)

  return (
    <div className="group relative flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex-shrink-0 h-20 w-20 rounded-lg bg-accent flex items-center justify-center overflow-hidden">
        {product.photo_url ? (
          <img src={product.photo_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="text-3xl">{emoji}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground leading-tight">{product.name}</h3>
        {product.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
        )}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{formatBRL(product.price)}</span>
          {restaurantOpen ? (
            <button
              onClick={onClick}
              className="flex items-center gap-1 h-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-150 active:scale-90 px-2.5"
              aria-label="Adicionar ao carrinho"
            >
              <Plus className="h-3.5 w-3.5" />
              {quantityInCart > 0 && <span className="text-xs font-semibold">{quantityInCart}</span>}
            </button>
          ) : (
            <Badge variant="destructive" className="text-xs">Indisponível</Badge>
          )}
        </div>
        {hasAddons && restaurantOpen && (
          <p className="mt-1 text-[10px] text-muted-foreground">Personalizável</p>
        )}
      </div>
    </div>
  )
}

function EmptyMenu() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent mb-4">
        <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">Cardápio vazio</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">Nenhum item disponível no momento. Volte mais tarde!</p>
    </div>
  )
}

// ── Product Detail Panel (escolha de adicionais) ──

function ProductDetailPanel({
  product, addons, onClose, onConfirm,
}: {
  product: Product
  addons: Addon[]
  onClose: () => void
  onConfirm: (addons: Addon[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleAddon = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedAddons = addons.filter((a) => selected.has(a.id))
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0)
  const total = product.price + addonsTotal

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col max-h-[85dvh] rounded-t-2xl bg-card shadow-2xl animate-slide-up border-t border-border">
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{product.name}</h2>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {product.photo_url && (
            <img src={product.photo_url} alt={product.name} className="w-full h-40 object-cover rounded-lg" />
          )}
          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Adicionais</h3>
            <p className="text-xs text-muted-foreground">Escolha os extras que quiser (opcional)</p>
            <div className="space-y-2 mt-2">
              {addons.map((addon) => (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => toggleAddon(addon.id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150 ${selected.has(addon.id) ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${selected.has(addon.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                      {selected.has(addon.id) && <Plus className="h-3 w-3 rotate-45" />}
                    </div>
                    <span className="text-sm font-medium text-foreground">{addon.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {addon.price > 0 ? `+ ${formatBRL(addon.price)}` : 'Grátis'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-card rounded-b-2xl">
          <Button onClick={() => onConfirm(selectedAddons)} className="w-full h-12 text-base font-semibold">
            Adicionar · {formatBRL(total)}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Cart Panel ──

function CartPanel({
  cart, cartTotal, cartItemCount, restaurantName, onIncrement, onDecrement, onRemove, onClose, onCheckout,
}: {
  cart: CartItem[]
  cartTotal: number
  cartItemCount: number
  restaurantName: string
  onIncrement: (cartId: string) => void
  onDecrement: (cartId: string) => void
  onRemove: (cartId: string) => void
  onClose: () => void
  onCheckout: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col max-h-[80dvh] rounded-t-2xl bg-card shadow-2xl animate-slide-up border-t border-border">
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Seu carrinho</h2>
              <p className="text-xs text-muted-foreground">{cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'} · {restaurantName}</p>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors" aria-label="Fechar carrinho">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {cart.map((item) => (
            <div key={item.cartId} className="flex items-start gap-3 rounded-lg border border-border bg-background p-2.5">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-lg">
                {getFoodEmoji(item.product.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                {item.addons.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    + {item.addons.map((a) => a.name).join(', ')}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{formatBRL(itemUnitPrice(item))} cada</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onDecrement(item.cartId)} className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="Remover">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                  <button onClick={() => onIncrement(item.cartId)} className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-90" aria-label="Adicionar">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatBRL(itemUnitPrice(item) * item.quantity)}</span>
              </div>
            </div>
          ))}
        </div>

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

// ── Checkout Panel ──

function CheckoutPanel({
  cart, cartTotal, cartItemCount, restaurantName, submitting, onSubmit, onClose, onBack,
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
    customer_name: '', customer_phone: '', address: '', payment_method: 'cash', change_for: '', notes: '',
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
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col max-h-[90dvh] rounded-t-2xl bg-card shadow-2xl animate-slide-up border-t border-border">
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors" aria-label="Voltar ao carrinho">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Checkout</h2>
                <p className="text-xs text-muted-foreground">{cartItemCount} itens · {formatBRL(cartTotal)}</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Resumo do pedido</p>
            {cart.map((item) => (
              <div key={item.cartId} className="flex items-start justify-between text-sm gap-2">
                <span className="text-foreground flex-1">
                  {item.quantity}x {item.product.name}
                  {item.addons.length > 0 && (
                    <span className="block text-xs text-muted-foreground">+ {item.addons.map((a) => a.name).join(', ')}</span>
                  )}
                </span>
                <span className="text-muted-foreground flex-shrink-0">{formatBRL(itemUnitPrice(item) * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-sm font-bold text-primary">{formatBRL(cartTotal)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome *</label>
            <Input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} placeholder="Seu nome completo" className={errors.customer_name ? 'border-destructive' : ''} />
            {errors.customer_name && <p className="text-xs text-destructive">{errors.customer_name}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Telefone *</label>
            <Input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} placeholder="(66) 99999-9999" type="tel" className={errors.customer_phone ? 'border-destructive' : ''} />
            {errors.customer_phone && <p className="text-xs text-destructive">{errors.customer_phone}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Endereço de entrega *</label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Rua, número, bairro" className={errors.address ? 'border-destructive' : ''} />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Forma de pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setForm((f) => ({ ...f, payment_method: 'cash', change_for: '' }))}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150 ${form.payment_method === 'cash' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}>
                <span className="text-xl">💵</span>Dinheiro
              </button>
              <button type="button" onClick={() => setForm((f) => ({ ...f, payment_method: 'card', change_for: '' }))}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150 ${form.payment_method === 'card' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}>
                <span className="text-xl">💳</span>Cartão
              </button>
              <button type="button" onClick={() => setForm((f) => ({ ...f, payment_method: 'pix', change_for: '' }))}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150 ${form.payment_method === 'pix' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}>
                <span className="text-xl">⚡</span>Pix
              </button>
            </div>

            {form.payment_method === 'cash' && (
              <div className="mt-2 space-y-1.5">
                <label className="text-sm font-medium text-foreground">Troco para quanto? <span className="text-muted-foreground font-normal">(opcional)</span></label>
                <Input value={form.change_for} onChange={(e) => setForm((f) => ({ ...f, change_for: e.target.value }))} placeholder="Ex: 50,00" type="number" inputMode="decimal" />
                <p className="text-xs text-muted-foreground">Deixe em branco se não precisar de troco</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Observações</label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Ex: sem cebola, sem molho..." />
          </div>

          <div className="rounded-lg bg-accent px-3 py-2.5 flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-accent-foreground">Entrega em aproximadamente 40-60 minutos. Pedidos feitos após as 22h serão entregues no dia seguinte.</p>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-card rounded-b-2xl">
          <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 text-base font-semibold">
            {submitting ? 'Enviando pedido...' : `Confirmar pedido · ${formatBRL(cartTotal)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
