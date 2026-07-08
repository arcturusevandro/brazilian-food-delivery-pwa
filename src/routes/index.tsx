import { createFileRoute } from '@tanstack/react-router'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Sabor Express — Cardápio' },
      { name: 'description', content: 'Peça sua comida brasileira favorita. Cardápio online com delivery rápido.' },
      { name: 'theme-color', content: '#F97316' },
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
  useEffect(() => { import('@/lib/pwa').then((m) => m.registerSW()) }, [])
  return null
}

function LoadingShell() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center">
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
import { Plus, Minus, X, Clock, MapPin, UtensilsCrossed, ChefHat, AlertCircle, ArrowLeft, ShoppingBag } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────
interface Restaurant { id: string; name: string; slug: string; logo_url: string | null; is_open: boolean }
interface Category { id: string; restaurant_id: string; name: string; sort_order: number }
interface Product { id: string; restaurant_id: string; category_id: string; name: string; description: string | null; price: number; photo_url: string | null; available: boolean }
interface Addon { id: string; product_id: string; name: string; price: number; available: boolean }
interface CartItem { cartId: string; product: Product; quantity: number; addons: Addon[] }
interface DeliverySettings { type: 'free' | 'fixed' | 'by_neighborhood'; fixed_fee: number }
interface DeliveryZone { id: string; neighborhood: string; fee: number; available: boolean }
type PaymentMethod = 'cash' | 'card' | 'pix'
interface CheckoutForm { customer_name: string; customer_phone: string; address: string; neighborhood: string; payment_method: PaymentMethod; change_for: string; notes: string }

function formatBRL(v: number): string { return `R$ ${v.toFixed(2).replace('.', ',')}` }
const FOOD_EMOJIS = ['🍔','🍕','🥗','🍜','🥩','🍗','🧆','🌮','🍟','🥪','🍛','🥘','🍲','🍝','🍱','🥟','🍳','🧀','🌯','🍽️']
function getFoodEmoji(name: string): string { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return FOOD_EMOJIS[Math.abs(h) % FOOD_EMOJIS.length] }
function itemUnitPrice(item: CartItem): number { return item.product.price + item.addons.reduce((s, a) => s + a.price, 0) }

// ── Main Shell ───────────────────────────────────────────────────
function MenuShell() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [addonsByProduct, setAddonsByProduct] = useState<Map<string, Addon[]>>(new Map())
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>({ type: 'free', fixed_fee: 0 })
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [orderConfirmed, setOrderConfirmed] = useState<{ id: string; total: number; deliveryFee: number } | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true); setError(null)
        const { data: r, error: re } = await supabase.from('restaurants').select('*').limit(1).maybeSingle()
        if (re) throw re
        if (!r) { setRestaurant(null); setLoading(false); return }
        setRestaurant(r)
        const [catRes, prodRes, delRes, zoneRes] = await Promise.all([
          supabase.from('categories').select('*').eq('restaurant_id', r.id).order('sort_order'),
          supabase.from('products').select('*').eq('restaurant_id', r.id).eq('available', true),
          supabase.from('delivery_settings').select('*').eq('restaurant_id', r.id).maybeSingle(),
          supabase.from('delivery_zones').select('*').eq('restaurant_id', r.id).eq('available', true).order('neighborhood'),
        ])
        if (catRes.error) throw catRes.error
        if (prodRes.error) throw prodRes.error
        setCategories(catRes.data || [])
        setProducts(prodRes.data || [])
        if (delRes.data) setDeliverySettings(delRes.data as DeliverySettings)
        if (!zoneRes.error) setDeliveryZones(zoneRes.data as DeliveryZone[] || [])
        const ids = (prodRes.data || []).map((p: any) => p.id)
        if (ids.length > 0) {
          const { data: addons } = await supabase.from('product_addons').select('*').in('product_id', ids).eq('available', true)
          const map = new Map<string, Addon[]>()
          for (const a of (addons || [])) { const l = map.get(a.product_id) || []; l.push(a); map.set(a.product_id, l) }
          setAddonsByProduct(map)
        }
      } catch (err: any) { setError(err.message || 'Erro ao carregar cardápio') }
      finally { setLoading(false) }
    }
    fetchData()
  }, [])

  const addSimple = useCallback((product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id && i.addons.length === 0)
      if (ex) return prev.map(i => i.cartId === ex.cartId ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { cartId: `${product.id}-${Date.now()}`, product, quantity: 1, addons: [] }]
    })
  }, [])

  const addWithAddons = useCallback((product: Product, addons: Addon[]) => {
    setCart(prev => [...prev, { cartId: `${product.id}-${Date.now()}`, product, quantity: 1, addons }])
  }, [])

  const handleProductClick = useCallback((product: Product) => {
    const addons = addonsByProduct.get(product.id) || []
    if (addons.length > 0) setDetailProduct(product)
    else addSimple(product)
  }, [addonsByProduct, addSimple])

  const increment = useCallback((cartId: string) => setCart(prev => prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i)), [])
  const decrement = useCallback((cartId: string) => setCart(prev => { const i = prev.find(x => x.cartId === cartId); if (i && i.quantity > 1) return prev.map(x => x.cartId === cartId ? { ...x, quantity: x.quantity - 1 } : x); return prev.filter(x => x.cartId !== cartId) }), [])
  const removeItem = useCallback((cartId: string) => setCart(prev => prev.filter(i => i.cartId !== cartId)), [])

  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + itemUnitPrice(i) * i.quantity, 0), [cart])
  const cartItemCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart])
  const productQty = useCallback((id: string) => cart.filter(i => i.product.id === id).reduce((s, i) => s + i.quantity, 0), [cart])

  const submitOrder = useCallback(async (form: CheckoutForm, deliveryFee: number) => {
    if (!restaurant || cart.length === 0) return
    if (!restaurant.is_open) { alert('O restaurante está fechado no momento. Tente novamente mais tarde.'); return }
    setSubmitting(true)
    try {
      const total = cartSubtotal + deliveryFee
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { const { error: ae } = await supabase.auth.signInAnonymously(); if (ae) throw ae }
      let notes = form.notes || ''
      if (form.payment_method === 'cash' && form.change_for.trim()) {
        const t = `Troco para: R$ ${form.change_for}`; notes = notes ? `${t} | ${notes}` : t
      }
      const { data: od, error: oe } = await supabase.from('orders').insert({
        restaurant_id: restaurant.id, customer_name: form.customer_name, customer_phone: form.customer_phone,
        address: form.address, neighborhood: form.neighborhood || null, payment_method: form.payment_method,
        status: 'pending', total, delivery_fee: deliveryFee, notes: notes || null,
      }).select('id').single()
      if (oe) throw oe
      const items = cart.map(i => ({
        order_id: od.id, product_id: i.product.id,
        product_name: i.addons.length > 0 ? `${i.product.name} (+ ${i.addons.map(a => a.name).join(', ')})` : i.product.name,
        quantity: i.quantity, unit_price: itemUnitPrice(i),
      }))
      const { error: ie } = await supabase.from('order_items').insert(items)
      if (ie) throw ie
      setCart([])
      setCheckoutOpen(false)
      setOrderConfirmed({ id: od.id, total, deliveryFee })
    } catch (err: any) {
      alert(`Erro ao fazer pedido: ${err.message || 'Tente novamente.'}`)
    } finally { setSubmitting(false) }
  }, [restaurant, cart, cartSubtotal])

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const cat of categories) { const p = products.filter(x => x.category_id === cat.id); if (p.length) map.set(cat.id, p) }
    return map
  }, [categories, products])

  const uncategorized = useMemo(() => products.filter(p => !categories.some(c => c.id === p.category_id)), [products, categories])

  if (loading) return <LoadingShell />

  if (error) return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-lg font-semibold">Erro ao carregar</h2>
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
    </div>
  )

  if (!restaurant) return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
      <UtensilsCrossed className="h-16 w-16 text-muted-foreground/40" />
      <h2 className="text-xl font-semibold">Em breve!</h2>
      <p className="text-sm text-muted-foreground max-w-xs">Nosso cardápio está sendo preparado. Volte logo!</p>
    </div>
  )

  return (
    <>
      <div className="min-h-dvh bg-background pb-28">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
            <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md overflow-hidden">
              {restaurant.logo_url ? <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full object-cover" /> : <ChefHat className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold truncate">{restaurant.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={restaurant.is_open ? 'default' : 'destructive'} className="gap-1 text-xs">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${restaurant.is_open ? 'bg-primary-foreground' : 'bg-destructive-foreground'}`} />
                  {restaurant.is_open ? 'Aberto' : 'Fechado'}
                </Badge>
                {restaurant.is_open && <span className="text-muted-foreground text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Aceitando pedidos</span>}
              </div>
            </div>
          </div>
        </header>

        {/* Banner restaurante fechado */}
        {!restaurant.is_open && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 text-center">
            <p className="text-sm font-medium text-destructive">
              🔴 Estamos fechados no momento — aceitaremos pedidos em breve!
            </p>
          </div>
        )}

        {/* Menu */}
        <main className="mx-auto max-w-3xl px-4 py-6">
          {categories.length === 0 && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent mb-4"><UtensilsCrossed className="h-10 w-10 text-muted-foreground" /></div>
              <h3 className="text-lg font-semibold">Cardápio vazio</h3>
              <p className="text-sm text-muted-foreground mt-1">Nenhum item disponível no momento.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {categories.map(cat => {
                const ps = productsByCategory.get(cat.id)
                if (!ps || ps.length === 0) return null
                return (
                  <section key={cat.id}>
                    <div className="sticky top-[73px] z-20 bg-background/95 backdrop-blur-sm py-3 mb-3">
                      <h2 className="text-base font-semibold flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-primary" />{cat.name}</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ps.map(p => <ProductCard key={p.id} product={p} qty={productQty(p.id)} hasAddons={(addonsByProduct.get(p.id) || []).length > 0} open={restaurant.is_open} onClick={() => handleProductClick(p)} />)}
                    </div>
                  </section>
                )
              })}
              {uncategorized.length > 0 && (
                <section>
                  <div className="sticky top-[73px] z-20 bg-background/95 backdrop-blur-sm py-3 mb-3">
                    <h2 className="text-base font-semibold flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-primary" />Mais itens</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {uncategorized.map(p => <ProductCard key={p.id} product={p} qty={productQty(p.id)} hasAddons={(addonsByProduct.get(p.id) || []).length > 0} open={restaurant.is_open} onClick={() => handleProductClick(p)} />)}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>

        {/* Barra de checkout */}
        {cart.length > 0 && !checkoutOpen && !detailProduct && !orderConfirmed && restaurant.is_open && (
          <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent">
            <button onClick={() => setCartOpen(true)} className="w-full flex items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-xl active:scale-[0.98] transition-all duration-150">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20 font-bold text-sm">{cartItemCount}</div>
                <span className="font-semibold text-sm">Ver carrinho</span>
              </div>
              <span className="font-bold text-base">{formatBRL(cartSubtotal)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tela de adicionais */}
      {detailProduct && (
        <ProductDetailPanel
          product={detailProduct}
          addons={addonsByProduct.get(detailProduct.id) || []}
          onClose={() => setDetailProduct(null)}
          onConfirm={addons => { addWithAddons(detailProduct, addons); setDetailProduct(null) }}
        />
      )}

      {/* Carrinho */}
      {cartOpen && (
        <CartPanel
          cart={cart} cartSubtotal={cartSubtotal} cartItemCount={cartItemCount}
          restaurantName={restaurant.name}
          onIncrement={increment} onDecrement={decrement} onRemove={removeItem}
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
        />
      )}

      {/* Checkout */}
      {checkoutOpen && (
        <CheckoutPanel
          cart={cart} cartSubtotal={cartSubtotal} cartItemCount={cartItemCount}
          restaurantName={restaurant.name} submitting={submitting}
          deliverySettings={deliverySettings} deliveryZones={deliveryZones}
          onSubmit={submitOrder}
          onClose={() => setCheckoutOpen(false)}
          onBack={() => { setCheckoutOpen(false); setCartOpen(true) }}
        />
      )}

      {/* Confirmação de pedido */}
      {orderConfirmed && (
        <OrderConfirmationPanel
          total={orderConfirmed.total}
          deliveryFee={orderConfirmed.deliveryFee}
          onClose={() => setOrderConfirmed(null)}
        />
      )}
    </>
  )
}

// ── Product Card ─────────────────────────────────────────────────
function ProductCard({ product, qty, hasAddons, open, onClick }: { product: Product; qty: number; hasAddons: boolean; open: boolean; onClick: () => void }) {
  return (
    <div className={`flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-all ${open ? "hover:shadow-md" : "opacity-70"}`}>
      <div className="flex-shrink-0 h-20 w-20 rounded-lg bg-accent flex items-center justify-center overflow-hidden">
        {product.photo_url ? <img src={product.photo_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-3xl">{getFoodEmoji(product.name)}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold leading-tight">{product.name}</h3>
        {product.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{product.description}</p>}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{formatBRL(product.price)}</span>
          {open ? (
            <button onClick={onClick} className="flex items-center gap-1 h-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-90 px-2.5">
              <Plus className="h-3.5 w-3.5" />
              {qty > 0 && <span className="text-xs font-semibold">{qty}</span>}
            </button>
          ) : <Badge variant="destructive" className="text-xs">Indisponível</Badge>}
        </div>
        {hasAddons && open && <p className="mt-1 text-[10px] text-muted-foreground">Personalizável</p>}
      </div>
    </div>
  )
}

// ── Product Detail (adicionais) ──────────────────────────────────
function ProductDetailPanel({ product, addons, onClose, onConfirm }: { product: Product; addons: Addon[]; onClose: () => void; onConfirm: (a: Addon[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const sel = addons.filter(a => selected.has(a.id))
  const total = product.price + sel.reduce((s, a) => s + a.price, 0)
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col max-h-[85dvh] rounded-t-2xl bg-card shadow-2xl animate-slide-up border-t border-border">
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {product.photo_url && <img src={product.photo_url} alt={product.name} className="w-full h-40 object-cover rounded-lg" />}
          {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Adicionais <span className="text-muted-foreground font-normal">(opcional)</span></h3>
            {addons.map(a => (
              <button key={a.id} type="button" onClick={() => toggle(a.id)}
                className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all ${selected.has(a.id) ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${selected.has(a.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                    {selected.has(a.id) && <Plus className="h-3 w-3 rotate-45" />}
                  </div>
                  <span className="text-sm font-medium">{a.name}</span>
                </div>
                <span className="text-sm font-semibold text-primary">{a.price > 0 ? `+ ${formatBRL(a.price)}` : 'Grátis'}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-card">
          <Button onClick={() => onConfirm(sel)} className="w-full h-12 text-base font-semibold">Adicionar · {formatBRL(total)}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Cart Panel ───────────────────────────────────────────────────
function CartPanel({ cart, cartSubtotal, cartItemCount, restaurantName, onIncrement, onDecrement, onRemove, onClose, onCheckout }: any) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col max-h-[80dvh] rounded-t-2xl bg-card shadow-2xl animate-slide-up border-t border-border">
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Seu carrinho</h2>
              <p className="text-xs text-muted-foreground">{cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'} · {restaurantName}</p>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {cart.map((item: CartItem) => (
            <div key={item.cartId} className="flex items-start gap-3 rounded-lg border border-border bg-background p-2.5">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-lg">{getFoodEmoji(item.product.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.product.name}</p>
                {item.addons.length > 0 && <p className="text-xs text-muted-foreground">+ {item.addons.map((a: Addon) => a.name).join(', ')}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{formatBRL(itemUnitPrice(item))} cada</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onDecrement(item.cartId)} className="flex h-6 w-6 items-center justify-center rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"><Minus className="h-3 w-3" /></button>
                  <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                  <button onClick={() => onIncrement(item.cartId)} className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-90"><Plus className="h-3 w-3" /></button>
                </div>
                <span className="text-sm font-semibold">{formatBRL(itemUnitPrice(item) * item.quantity)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex-shrink-0 border-t border-border px-4 py-3 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-lg font-bold">{formatBRL(cartSubtotal)}</span>
          </div>
          <Button onClick={onCheckout} className="w-full h-12 text-base font-semibold gap-2"><ShoppingBag className="h-5 w-5" />Ir para o checkout</Button>
        </div>
      </div>
    </div>
  )
}

// ── Checkout Panel ───────────────────────────────────────────────
function CheckoutPanel({ cart, cartSubtotal, cartItemCount, restaurantName, submitting, deliverySettings, deliveryZones, onSubmit, onClose, onBack }: any) {
  const [form, setForm] = useState<CheckoutForm>({ customer_name: '', customer_phone: '', address: '', neighborhood: '', payment_method: 'cash', change_for: '', notes: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({})

  const deliveryFee = useMemo(() => {
    if (deliverySettings.type === 'free') return 0
    if (deliverySettings.type === 'fixed') return deliverySettings.fixed_fee
    if (deliverySettings.type === 'by_neighborhood' && form.neighborhood) {
      const z = deliveryZones.find((x: DeliveryZone) => x.neighborhood === form.neighborhood)
      return z ? z.fee : 0
    }
    return 0
  }, [deliverySettings, deliveryZones, form.neighborhood])

  const total = cartSubtotal + deliveryFee

  const validate = () => {
    const n: Partial<Record<keyof CheckoutForm, string>> = {}
    if (!form.customer_name.trim()) n.customer_name = 'Nome é obrigatório'
    if (!form.customer_phone.trim()) n.customer_phone = 'Telefone é obrigatório'
    if (!form.address.trim()) n.address = 'Endereço é obrigatório'
    if (deliverySettings.type === 'by_neighborhood' && !form.neighborhood) n.neighborhood = 'Selecione o bairro'
    if (form.payment_method === 'cash' && form.change_for.trim()) {
      const cf = parseFloat(form.change_for.replace(',', '.'))
      if (!isNaN(cf) && cf < total) n.change_for = `Troco deve ser maior que o total (${formatBRL(total)})`
    }
    setErrors(n)
    return Object.keys(n).length === 0
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col max-h-[90dvh] rounded-t-2xl bg-card shadow-2xl animate-slide-up border-t border-border">
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"><ArrowLeft className="h-4 w-4" /></button>
              <div>
                <h2 className="text-lg font-semibold">Checkout</h2>
                <p className="text-xs text-muted-foreground">{cartItemCount} itens · {formatBRL(total)}</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Resumo */}
          <div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Resumo</p>
            {cart.map((item: CartItem) => (
              <div key={item.cartId} className="flex items-start justify-between text-sm gap-2">
                <span className="flex-1">{item.quantity}x {item.product.name}{item.addons.length > 0 && <span className="block text-xs text-muted-foreground">+ {item.addons.map((a: Addon) => a.name).join(', ')}</span>}</span>
                <span className="text-muted-foreground shrink-0">{formatBRL(itemUnitPrice(item) * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-1.5 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatBRL(cartSubtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Entrega</span><span className={deliveryFee === 0 ? 'text-green-600 font-medium' : ''}>{deliveryFee === 0 ? 'Grátis' : formatBRL(deliveryFee)}</span></div>
              <div className="flex justify-between font-bold pt-1 border-t border-border"><span className="text-sm">Total</span><span className="text-sm text-primary">{formatBRL(total)}</span></div>
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome *</label>
            <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Seu nome completo" className={errors.customer_name ? 'border-destructive' : ''} />
            {errors.customer_name && <p className="text-xs text-destructive">{errors.customer_name}</p>}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Telefone *</label>
            <Input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="(66) 99999-9999" type="tel" className={errors.customer_phone ? 'border-destructive' : ''} />
            {errors.customer_phone && <p className="text-xs text-destructive">{errors.customer_phone}</p>}
          </div>

          {/* Bairro */}
          {deliverySettings.type === 'by_neighborhood' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bairro *</label>
              <select value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))}
                className={`w-full h-10 rounded-md border px-3 text-sm bg-background text-foreground ${errors.neighborhood ? 'border-destructive' : 'border-input'}`}>
                <option value="">Selecione seu bairro...</option>
                {deliveryZones.map((z: DeliveryZone) => <option key={z.id} value={z.neighborhood}>{z.neighborhood} — {z.fee > 0 ? formatBRL(z.fee) : 'Grátis'}</option>)}
              </select>
              {errors.neighborhood && <p className="text-xs text-destructive">{errors.neighborhood}</p>}
            </div>
          )}

          {/* Endereço */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Endereço *</label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número" className={errors.address ? 'border-destructive' : ''} />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          {/* Pagamento */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Forma de pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ v: 'cash', l: 'Dinheiro', e: '💵' }, { v: 'card', l: 'Cartão', e: '💳' }, { v: 'pix', l: 'Pix', e: '⚡' }].map(opt => (
                <button key={opt.v} type="button" onClick={() => setForm(f => ({ ...f, payment_method: opt.v as PaymentMethod, change_for: '' }))}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all ${form.payment_method === opt.v ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}>
                  <span className="text-xl">{opt.e}</span>{opt.l}
                </button>
              ))}
            </div>
            {form.payment_method === 'cash' && (
              <div className="mt-2 space-y-1.5">
                <label className="text-sm font-medium">Troco para quanto? <span className="text-muted-foreground font-normal">(opcional)</span></label>
                <Input value={form.change_for} onChange={e => setForm(f => ({ ...f, change_for: e.target.value }))} placeholder="Ex: 50,00" type="number" inputMode="decimal" className={errors.change_for ? 'border-destructive' : ''} />
                {errors.change_for && <p className="text-xs text-destructive">{errors.change_for}</p>}
                {!errors.change_for && <p className="text-xs text-muted-foreground">Deixe em branco se não precisar de troco</p>}
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Observações</label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex: sem cebola, sem molho..." />
          </div>

          <div className="rounded-lg bg-accent px-3 py-2.5 flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-accent-foreground">Entrega em aproximadamente 40-60 minutos.</p>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-card">
          <Button onClick={() => { if (validate()) onSubmit(form, deliveryFee) }} disabled={submitting} className="w-full h-12 text-base font-semibold">
            {submitting ? 'Enviando pedido...' : `Confirmar pedido · ${formatBRL(total)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Order Confirmation ───────────────────────────────────────────
function OrderConfirmationPanel({ total, deliveryFee, onClose }: { total: number; deliveryFee: number; onClose: () => void }) {
  const subtotal = total - deliveryFee
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl bg-card shadow-2xl p-6 flex flex-col items-center gap-4 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold">Pedido realizado!</h2>
          <p className="text-sm text-muted-foreground">Seu pedido foi recebido com sucesso</p>
        </div>
        <div className="w-full rounded-xl bg-muted/50 p-4 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
          <div className="flex justify-between text-sm text-muted-foreground"><span>Entrega</span><span>{deliveryFee > 0 ? formatBRL(deliveryFee) : 'Grátis'}</span></div>
          <div className="flex justify-between font-bold text-foreground border-t border-border pt-2"><span>Total</span><span className="text-primary">{formatBRL(total)}</span></div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground text-center">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Entrega em aproximadamente 40-60 minutos</span>
        </div>
        <Button onClick={onClose} className="w-full h-11 text-base font-semibold">Fazer novo pedido</Button>
      </div>
    </div>
  )
}
