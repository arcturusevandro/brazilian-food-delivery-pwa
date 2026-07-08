import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Input, Badge, Skeleton, Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Textarea, Label } from '@blinkdotnew/ui'
import { Plus, Pencil, Trash2, Package, X, Search, Upload, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Category {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
}

interface Product {
  id: string
  restaurant_id: string
  category_id: string | null
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

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

// ── Upload de imagem para Supabase Storage ───────────────────────
async function uploadProductImage(file: File, restaurantId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${restaurantId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(filename, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(`Erro ao fazer upload: ${error.message}`)

  const { data } = supabase.storage.from('product-images').getPublicUrl(filename)
  return data.publicUrl
}

// ── Componente de Upload de Foto ─────────────────────────────────
function PhotoUpload({
  value,
  onChange,
  restaurantId,
}: {
  value: string
  onChange: (url: string) => void
  restaurantId: string
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo 5MB.'); return }

    // Preview local imediato
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)

    try {
      const url = await uploadProductImage(file, restaurantId)
      setPreview(url)
      onChange(url)
      toast.success('Foto enviada!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar foto')
      setPreview(value) // reverte
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }

  const handleRemove = () => {
    setPreview('')
    onChange('')
  }

  return (
    <div className="space-y-2">
      <Label>Foto do produto</Label>

      {preview ? (
        <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border">
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-foreground">Enviando...</span>
              </div>
            </div>
          )}
          {!uploading && (
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground hover:bg-background transition-colors shadow"
                title="Trocar foto"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-destructive hover:bg-background transition-colors shadow"
                title="Remover foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center w-full h-36 rounded-lg border-2 border-dashed border-border bg-muted/30 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Clique ou arraste a foto aqui</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">JPG, PNG ou WebP — máx. 5MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

// ── Menu Manager Principal ───────────────────────────────────────
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
    toast.success('Categoria adicionada!')
    setNewCatName('')
    fetchData()
  }

  const saveCategory = async (id: string) => {
    if (!editCatName.trim()) return
    const { error } = await supabase.from('categories').update({ name: editCatName.trim() }).eq('id', id)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Categoria atualizada!')
    setEditingCategory(null)
    fetchData()
  }

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover categoria'); return }
    toast.success('Categoria removida!')
    fetchData()
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
    setProductDialogOpen(false)
    setEditingProduct(null)
    fetchData()
  }

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover produto'); return }
    toast.success('Produto removido!')
    fetchData()
  }

  const toggleProduct = async (product: Product) => {
    const { error } = await supabase.from('products').update({ available: !product.available }).eq('id', product.id)
    if (error) { toast.error('Erro ao alterar disponibilidade'); return }
    fetchData()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const filteredProducts = searchTerm
    ? products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : products

  return (
    <div className="space-y-8">
      {/* Categorias */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Categorias</h2>
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
      </section>

      {/* Produtos */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Produtos</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-9 pl-8 w-40 sm:w-56" />
            </div>
            <Button size="sm" onClick={() => { setEditingProduct(null); setProductDialogOpen(true) }}><Plus className="h-4 w-4 mr-1" />Produto</Button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
            <Package className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map(product => {
              const category = categories.find(c => c.id === product.category_id)
              return (
                <div key={product.id} className={cn('flex items-center gap-3 p-3 rounded-lg border border-border transition-colors', !product.available && 'opacity-50')}>
                  {/* Miniatura da foto */}
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                    {product.photo_url
                      ? <img src={product.photo_url} alt={product.name} className="h-full w-full object-cover" />
                      : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{product.name}</span>
                      {category && <Badge variant="outline" className="text-xs shrink-0">{category.name}</Badge>}
                      {!product.available && <Badge variant="secondary" className="text-xs shrink-0">Indisponível</Badge>}
                    </div>
                    {product.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>}
                  </div>
                  <span className="text-sm font-semibold shrink-0">{formatBRL(product.price)}</span>
                  <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => { setAddonProduct(product); setAddonDialogOpen(true) }}>Adicionais</Button>
                  <Switch checked={product.available} onCheckedChange={() => toggleProduct(product)} />
                  <Button size="sm" variant="ghost" onClick={() => { setEditingProduct(product); setProductDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteProduct(product.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        categories={categories}
        restaurantId={restaurantId}
        onSave={saveProduct}
      />
      <AddonManagerDialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen} product={addonProduct} />
    </div>
  )
}

// ── Formulário de Produto com Upload ─────────────────────────────
function ProductFormDialog({ open, onOpenChange, product, categories, restaurantId, onSave }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  categories: Category[]
  restaurantId: string
  onSave: (data: Partial<Product>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) {
      setName(product.name); setDescription(product.description || ''); setPrice(String(product.price))
      setCategoryId(product.category_id || ''); setPhotoUrl(product.photo_url || ''); setAvailable(product.available)
    } else {
      setName(''); setDescription(''); setPrice(''); setCategoryId(''); setPhotoUrl(''); setAvailable(true)
    }
  }, [product, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      price: parseFloat(price.replace(',', '.')),
      category_id: categoryId || null,
      photo_url: photoUrl || null,
      available,
    })
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <DialogDescription>Preencha os dados do produto abaixo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Upload de foto */}
          <PhotoUpload value={photoUrl} onChange={setPhotoUrl} restaurantId={restaurantId} />

          <div className="space-y-2">
            <Label htmlFor="p-name">Nome *</Label>
            <Input id="p-name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">Descrição</Label>
            <Textarea id="p-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-price">Preço (R$) *</Label>
              <Input id="p-price" value={price} onChange={e => setPrice(e.target.value)} placeholder="29,90" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-cat">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="p-cat"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="p-avail" checked={available} onCheckedChange={setAvailable} />
            <Label htmlFor="p-avail">Disponível para venda</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Gerenciador de Adicionais ─────────────────────────────────────
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
    toast.success('Adicional criado!')
    setNewName(''); setNewPrice('')
    fetchAddons()
  }

  const deleteAddon = async (id: string) => {
    const { error } = await supabase.from('product_addons').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    toast.success('Adicional removido!')
    fetchAddons()
  }

  const toggleAddon = async (addon: Addon) => {
    await supabase.from('product_addons').update({ available: !addon.available }).eq('id', addon.id)
    fetchAddons()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionais {product ? `— ${product.name}` : ''}</DialogTitle>
          <DialogDescription>Cadastre itens extras que o cliente pode adicionar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? <Skeleton className="h-24 w-full" /> : addons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum adicional cadastrado ainda.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {addons.map(addon => (
                <div key={addon.id} className={cn('flex items-center gap-2 p-2.5 rounded-lg border border-border', !addon.available && 'opacity-50')}>
                  <div className="flex-1 min-w-0"><span className="text-sm font-medium">{addon.name}</span></div>
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
            <p className="text-xs text-muted-foreground">Deixe o preço vazio para adicional gratuito.</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
