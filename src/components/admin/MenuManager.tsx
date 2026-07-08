import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Input, Badge, Skeleton, Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Textarea, Label, Tabs, TabsList, TabsTrigger, TabsContent } from '@blinkdotnew/ui'
import { Plus, Pencil, Trash2, Package, X, Search, Upload, Image as ImageIcon, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Category { id: string; restaurant_id: string; name: string; sort_order: number }
interface Product { id: string; restaurant_id: string; category_id: string | null; name: string; description: string | null; price: number; photo_url: string | null; available: boolean; is_combo?: boolean }
interface Addon { id: string; product_id: string; name: string; price: number; available: boolean }
interface ComboItem { id?: string; combo_id?: string; product_id: string; quantity: number; product?: Product }

function formatBRL(v: number): string { return `R$ ${v.toFixed(2).replace('.', ',')}` }

// ── Upload Supabase Storage ──────────────────────────────────────
async function uploadProductImage(file: File, restaurantId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${restaurantId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(filename, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(`Erro ao fazer upload: ${error.message}`)
  const { data } = supabase.storage.from('product-images').getPublicUrl(filename)
  return data.publicUrl
}

function PhotoUpload({ value, onChange, restaurantId }: { value: string; onChange: (url: string) => void; restaurantId: string }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo 5MB.'); return }
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadProductImage(file, restaurantId)
      setPreview(url); onChange(url); toast.success('Foto enviada!')
    } catch (err: any) { toast.error(err.message); setPreview(value) }
    finally { setUploading(false) }
  }

  return (
    <div className="space-y-2">
      <Label>Foto</Label>
      {preview ? (
        <div className="relative w-full h-36 rounded-lg overflow-hidden border border-border">
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          {uploading && <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}
          {!uploading && (
            <div className="absolute top-2 right-2 flex gap-1">
              <button type="button" onClick={() => inputRef.current?.click()} className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 hover:bg-background shadow"><Upload className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => { setPreview(''); onChange('') }} className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-destructive hover:bg-background shadow"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-border bg-muted/30 cursor-pointer hover:border-primary/50 transition-all" onClick={() => inputRef.current?.click()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleFile(f) }} onDragOver={e => e.preventDefault()}>
          <ImageIcon className="h-7 w-7 text-muted-foreground/50 mb-1.5" />
          <p className="text-sm text-muted-foreground">Clique ou arraste a foto</p>
          <p className="text-xs text-muted-foreground/70">JPG, PNG, WebP — máx. 5MB</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── MenuManager Principal ────────────────────────────────────────
export function MenuManager({ restaurantId }: { restaurantId: string }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [addonDialogOpen, setAddonDialogOpen] = useState(false)
  const [addonProduct, setAddonProduct] = useState<Product | null>(null)
  const [comboDialogOpen, setComboDialogOpen] = useState(false)
  const [editingCombo, setEditingCombo] = useState<Product | null>(null)

  const fetchData = useCallback(async () => {
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('products').select('*').eq('restaurant_id', restaurantId).order('name'),
    ])
    if (!catRes.error) setCategories(catRes.data as Category[])
    if (!prodRes.error) setProducts(prodRes.data as Product[])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { fetchData() }, [fetchData])

  const addCategory = async () => {
    if (!newCatName.trim()) return
    const { error } = await supabase.from('categories').insert({ restaurant_id: restaurantId, name: newCatName.trim(), sort_order: categories.length })
    if (error) { toast.error('Erro ao adicionar categoria'); return }
    toast.success('Categoria adicionada!'); setNewCatName(''); fetchData()
  }

  const saveCategory = async (id: string) => {
    if (!editCatName.trim()) return
    const { error } = await supabase.from('categories').update({ name: editCatName.trim() }).eq('id', id)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Categoria atualizada!'); setEditingCategory(null); fetchData()
  }

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover categoria'); return }
    toast.success('Categoria removida!'); fetchData()
  }

  const saveProduct = async (formData: Partial<Product>) => {
    if (editingProduct) {
      const { error } = await supabase.from('products').update(formData).eq('id', editingProduct.id)
      if (error) { toast.error('Erro ao atualizar produto'); return }
      toast.success('Produto atualizado!')
    } else {
      const { error } = await supabase.from('products').insert({ ...formData, restaurant_id: restaurantId })
      if (error) { toast.error('Erro ao criar produto'); return }
      toast.success('Produto adicionado!')
    }
    setProductDialogOpen(false); setEditingProduct(null); fetchData()
  }

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover produto'); return }
    toast.success('Produto removido!'); fetchData()
  }

  const toggleProduct = async (product: Product) => {
    await supabase.from('products').update({ available: !product.available }).eq('id', product.id)
    fetchData()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>

  const regularProducts = products.filter(p => !p.is_combo)
  const combos = products.filter(p => p.is_combo)
  const filteredProducts = searchTerm ? regularProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : regularProducts
  const filteredCombos = searchTerm ? combos.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : combos

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto gap-1">
          <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            Produtos {regularProducts.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{regularProducts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="combos" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            Combos {combos.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{combos.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="categories" className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            Categorias
          </TabsTrigger>
        </TabsList>

        {/* ── Produtos ── */}
        <TabsContent value="products" className="mt-4">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-9 pl-8 w-48" />
            </div>
            <Button size="sm" onClick={() => { setEditingProduct(null); setProductDialogOpen(true) }}><Plus className="h-4 w-4 mr-1" />Produto</Button>
          </div>
          <ProductList products={filteredProducts} categories={categories} onEdit={p => { setEditingProduct(p); setProductDialogOpen(true) }} onDelete={deleteProduct} onToggle={toggleProduct} onAddons={p => { setAddonProduct(p); setAddonDialogOpen(true) }} />
        </TabsContent>

        {/* ── Combos ── */}
        <TabsContent value="combos" className="mt-4">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar combo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-9 pl-8 w-48" />
            </div>
            <Button size="sm" onClick={() => { setEditingCombo(null); setComboDialogOpen(true) }}><Plus className="h-4 w-4 mr-1" />Combo</Button>
          </div>
          {filteredCombos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum combo cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1">Crie combos com produtos e preço especial</p>
            </div>
          ) : (
            <ProductList products={filteredCombos} categories={categories} onEdit={p => { setEditingCombo(p); setComboDialogOpen(true) }} onDelete={deleteProduct} onToggle={toggleProduct} isCombo />
          )}
        </TabsContent>

        {/* ── Categorias ── */}
        <TabsContent value="categories" className="mt-4">
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2">
                {editingCategory === cat.id ? (
                  <>
                    <Input value={editCatName} onChange={e => setEditCatName(e.target.value)} className="h-9 max-w-xs" onKeyDown={e => e.key === 'Enter' && saveCategory(cat.id)} autoFocus />
                    <Button size="sm" variant="ghost" onClick={() => saveCategory(cat.id)}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm px-3 py-1.5 bg-muted rounded-md">{cat.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingCategory(cat.id); setEditCatName(cat.name) }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteCategory(cat.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input placeholder="Nova categoria..." value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-9 max-w-xs" onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <Button size="sm" variant="outline" onClick={addCategory} disabled={!newCatName.trim()}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ProductFormDialog open={productDialogOpen} onOpenChange={setProductDialogOpen} product={editingProduct} categories={categories} restaurantId={restaurantId} onSave={saveProduct} />
      <ComboFormDialog open={comboDialogOpen} onOpenChange={setComboDialogOpen} combo={editingCombo} categories={categories} restaurantId={restaurantId} allProducts={regularProducts} onSaved={() => { setComboDialogOpen(false); setEditingCombo(null); fetchData() }} />
      <AddonManagerDialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen} product={addonProduct} />
    </div>
  )
}

// ── Lista de Produtos ─────────────────────────────────────────────
function ProductList({ products, categories, onEdit, onDelete, onToggle, onAddons, isCombo = false }: {
  products: Product[]; categories: Category[]; onEdit: (p: Product) => void; onDelete: (id: string) => void; onToggle: (p: Product) => void; onAddons?: (p: Product) => void; isCombo?: boolean
}) {
  if (products.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
      <Package className="h-10 w-10 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {products.map(product => {
        const category = categories.find(c => c.id === product.category_id)
        return (
          <div key={product.id} className={cn('flex items-center gap-3 p-3 rounded-lg border border-border transition-colors', !product.available && 'opacity-50')}>
            <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
              {product.photo_url ? <img src={product.photo_url} alt={product.name} className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{product.name}</span>
                {category && <Badge variant="outline" className="text-xs shrink-0">{category.name}</Badge>}
                {!product.available && <Badge variant="secondary" className="text-xs shrink-0">Indisponível</Badge>}
              </div>
              {product.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>}
            </div>
            <span className="text-sm font-semibold shrink-0">{formatBRL(product.price)}</span>
            {!isCombo && onAddons && <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => onAddons(product)}>Adicionais</Button>}
            <Switch checked={product.available} onCheckedChange={() => onToggle(product)} />
            <Button size="sm" variant="ghost" onClick={() => onEdit(product)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(product.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        )
      })}
    </div>
  )
}

// ── Dialog de Produto ─────────────────────────────────────────────
function ProductFormDialog({ open, onOpenChange, product, categories, restaurantId, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; product: Product | null; categories: Category[]; restaurantId: string; onSave: (d: Partial<Product>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) { setName(product.name); setDescription(product.description || ''); setPrice(String(product.price)); setCategoryId(product.category_id || ''); setPhotoUrl(product.photo_url || ''); setAvailable(product.available) }
    else { setName(''); setDescription(''); setPrice(''); setCategoryId(''); setPhotoUrl(''); setAvailable(true) }
  }, [product, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price) return
    setSaving(true)
    await onSave({ name: name.trim(), description: description.trim() || null, price: parseFloat(price.replace(',', '.')), category_id: categoryId || null, photo_url: photoUrl || null, available, is_combo: false })
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle><DialogDescription>Preencha os dados do produto.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PhotoUpload value={photoUrl} onChange={setPhotoUrl} restaurantId={restaurantId} />
          <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Preço (R$) *</Label><Input value={price} onChange={e => setPrice(e.target.value)} placeholder="29,90" required /></div>
            <div className="space-y-2"><Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent><SelectItem value="">Nenhuma</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={available} onCheckedChange={setAvailable} /><Label>Disponível para venda</Label></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Dialog de Combo ───────────────────────────────────────────────
function ComboFormDialog({ open, onOpenChange, combo, categories, restaurantId, allProducts, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; combo: Product | null; categories: Category[]; restaurantId: string; allProducts: Product[]; onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [available, setAvailable] = useState(true)
  const [items, setItems] = useState<ComboItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (combo) {
      setName(combo.name); setPrice(String(combo.price)); setCategoryId(combo.category_id || ''); setPhotoUrl(combo.photo_url || ''); setAvailable(combo.available)
      // Carrega itens do combo
      supabase.from('combo_items').select('*, product:products(*)').eq('combo_id', combo.id).then(({ data }) => {
        if (data) setItems(data as ComboItem[])
      })
    } else {
      setName(''); setPrice(''); setCategoryId(''); setPhotoUrl(''); setAvailable(true); setItems([])
    }
  }, [combo, open])

  const addItem = () => {
    if (allProducts.length === 0) return
    setItems(prev => [...prev, { product_id: allProducts[0].id, quantity: 1, product: allProducts[0] }])
  }

  const updateItem = (index: number, field: 'product_id' | 'quantity', value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (field === 'product_id') {
        const product = allProducts.find(p => p.id === value)
        return { ...item, product_id: value, product }
      }
      return { ...item, [field]: value }
    }))
  }

  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index))

  const subtotal = items.reduce((sum, item) => {
    const product = allProducts.find(p => p.id === item.product_id)
    return sum + (product?.price || 0) * item.quantity
  }, 0)

  const handleSave = async () => {
    if (!name.trim() || !price) { toast.error('Preencha nome e preço'); return }
    if (items.length === 0) { toast.error('Adicione pelo menos 1 item ao combo'); return }
    setSaving(true)
    try {
      let comboId = combo?.id

      if (combo) {
        const { error } = await supabase.from('products').update({
          name: name.trim(), price: parseFloat(price.replace(',', '.')),
          category_id: categoryId || null, photo_url: photoUrl || null, available,
        }).eq('id', combo.id)
        if (error) throw error
        // Remove itens antigos
        await supabase.from('combo_items').delete().eq('combo_id', combo.id)
      } else {
        const { data, error } = await supabase.from('products').insert({
          restaurant_id: restaurantId, name: name.trim(),
          price: parseFloat(price.replace(',', '.')),
          category_id: categoryId || null, photo_url: photoUrl || null,
          available, is_combo: true,
          description: items.map(i => `${i.quantity}x ${allProducts.find(p => p.id === i.product_id)?.name || ''}`).join(' + '),
        }).select('id').single()
        if (error) throw error
        comboId = data.id
      }

      // Insere itens do combo
      const { error: itemsError } = await supabase.from('combo_items').insert(
        items.map(item => ({ combo_id: comboId, product_id: item.product_id, quantity: item.quantity }))
      )
      if (itemsError) throw itemsError

      // Atualiza descrição com os itens
      const description = items.map(i => `${i.quantity}x ${allProducts.find(p => p.id === i.product_id)?.name || ''}`).join(' + ')
      await supabase.from('products').update({ description }).eq('id', comboId)

      toast.success(combo ? 'Combo atualizado!' : 'Combo criado!')
      onSaved()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar combo')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{combo ? 'Editar Combo' : 'Novo Combo'}</DialogTitle><DialogDescription>Monte o combo selecionando os produtos e quantidades.</DialogDescription></DialogHeader>

        <div className="space-y-4">
          <PhotoUpload value={photoUrl} onChange={setPhotoUrl} restaurantId={restaurantId} />

          <div className="space-y-2"><Label>Nome do combo *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Combo X-Bacon" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Preço especial (R$) *</Label><Input value={price} onChange={e => setPrice(e.target.value)} placeholder="35,90" /></div>
            <div className="space-y-2"><Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent><SelectItem value="">Nenhuma</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Itens do combo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens do combo *</Label>
              <Button size="sm" variant="outline" type="button" onClick={addItem} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Adicionar item</Button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border rounded-lg">
                <p className="text-sm text-muted-foreground">Nenhum item adicionado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => updateItem(index, 'quantity', Math.max(1, item.quantity - 1))} className="flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border hover:bg-primary hover:text-primary-foreground transition-colors text-xs font-bold">−</button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button type="button" onClick={() => updateItem(index, 'quantity', item.quantity + 1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-bold">+</button>
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0">×</span>
                    <Select value={item.product_id} onValueChange={v => updateItem(index, 'product_id', v)}>
                      <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{allProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {formatBRL(p.price)}</SelectItem>)}</SelectContent>
                    </Select>
                    <button type="button" onClick={() => removeItem(index)} className="flex h-6 w-6 items-center justify-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Resumo de preços */}
            {items.length > 0 && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Soma dos itens</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>
                {price && !isNaN(parseFloat(price.replace(',', '.'))) && (
                  <div className="flex justify-between text-xs font-medium">
                    <span>Preço do combo</span>
                    <span className={parseFloat(price.replace(',', '.')) < subtotal ? 'text-green-600' : 'text-foreground'}>
                      {formatBRL(parseFloat(price.replace(',', '.')))}
                    </span>
                  </div>
                )}
                {price && !isNaN(parseFloat(price.replace(',', '.'))) && subtotal > 0 && parseFloat(price.replace(',', '.')) < subtotal && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Economia</span>
                    <span>{formatBRL(subtotal - parseFloat(price.replace(',', '.')))} ({Math.round((1 - parseFloat(price.replace(',', '.')) / subtotal) * 100)}% off)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2"><Switch checked={available} onCheckedChange={setAvailable} /><Label>Disponível para venda</Label></div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : combo ? 'Salvar' : 'Criar Combo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Adicionais ────────────────────────────────────────────────────
function AddonManagerDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product: Product | null }) {
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')

  const fetchAddons = useCallback(async () => {
    if (!product) return
    setLoading(true)
    const { data, error } = await supabase.from('product_addons').select('*').eq('product_id', product.id).order('name')
    if (!error) setAddons(data as Addon[])
    setLoading(false)
  }, [product])

  useEffect(() => { if (open) fetchAddons() }, [open, fetchAddons])

  const addAddon = async () => {
    if (!product || !newName.trim()) return
    const { error } = await supabase.from('product_addons').insert({ product_id: product.id, name: newName.trim(), price: newPrice ? parseFloat(newPrice.replace(',', '.')) : 0, available: true })
    if (error) { toast.error('Erro ao adicionar'); return }
    toast.success('Adicional criado!'); setNewName(''); setNewPrice(''); fetchAddons()
  }

  const deleteAddon = async (id: string) => {
    await supabase.from('product_addons').delete().eq('id', id)
    toast.success('Adicional removido!'); fetchAddons()
  }

  const toggleAddon = async (addon: Addon) => {
    await supabase.from('product_addons').update({ available: !addon.available }).eq('id', addon.id)
    fetchAddons()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Adicionais {product ? `— ${product.name}` : ''}</DialogTitle><DialogDescription>Cadastre itens extras que o cliente pode adicionar.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {loading ? <Skeleton className="h-24 w-full" /> : addons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum adicional ainda.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {addons.map(addon => (
                <div key={addon.id} className={cn('flex items-center gap-2 p-2.5 rounded-lg border border-border', !addon.available && 'opacity-50')}>
                  <div className="flex-1"><span className="text-sm font-medium">{addon.name}</span></div>
                  <span className="text-sm font-semibold shrink-0">{addon.price > 0 ? formatBRL(addon.price) : 'Grátis'}</span>
                  <Switch checked={addon.available} onCheckedChange={() => toggleAddon(addon)} />
                  <Button size="sm" variant="ghost" onClick={() => deleteAddon(addon.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-border pt-3 space-y-2">
            <Label className="text-sm font-medium">Novo adicional</Label>
            <div className="flex items-center gap-2">
              <Input placeholder="Ex: Bacon extra" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && addAddon()} />
              <Input placeholder="Preço" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-24" onKeyDown={e => e.key === 'Enter' && addAddon()} />
              <Button size="sm" onClick={addAddon} disabled={!newName.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Preço vazio = gratuito.</p>
          </div>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
