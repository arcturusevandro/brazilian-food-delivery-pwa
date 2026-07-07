import { useState, useEffect } from 'react'
import { Button, Input, Label, Switch, Skeleton } from '@blinkdotnew/ui'
import { supabase } from '@/lib/supabase'
import { Restaurant } from '@/hooks/useRestaurant'
import toast from 'react-hot-toast'

export function RestaurantSettings({
  restaurant,
  onUpdated,
}: {
  restaurant: Restaurant
  onUpdated: () => void
}) {
  const [name, setName] = useState(restaurant.name)
  const [phone, setPhone] = useState(restaurant.phone || '')
  const [address, setAddress] = useState(restaurant.address || '')
  const [logoUrl, setLogoUrl] = useState(restaurant.logo_url || '')
  const [isOpen, setIsOpen] = useState(restaurant.is_open)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(restaurant.name)
    setPhone(restaurant.phone || '')
    setAddress(restaurant.address || '')
    setLogoUrl(restaurant.logo_url || '')
    setIsOpen(restaurant.is_open)
  }, [restaurant])

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const slug = name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()

      const { error } = await supabase
        .from('restaurants')
        .update({
          name: name.trim(),
          slug,
          phone: phone.trim() || null,
          address: address.trim() || null,
          logo_url: logoUrl.trim() || null,
          is_open: isOpen,
        })
        .eq('id', restaurant.id)

      if (error) throw error
      toast.success('Configurações salvas!')
      onUpdated()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Informações do restaurante</h2>

        <div className="space-y-2">
          <Label htmlFor="r-name">Nome *</Label>
          <Input
            id="r-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Rei do Hamburguer"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="r-phone">Telefone / WhatsApp</Label>
          <Input
            id="r-phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(66) 99999-9999"
            type="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="r-address">Endereço do estabelecimento</Label>
          <Input
            id="r-address"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Rua, número, bairro"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="r-logo">URL do logo</Label>
          <Input
            id="r-logo"
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            placeholder="https://..."
          />
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Preview do logo"
              className="h-16 w-16 rounded-xl object-cover border border-border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Status do restaurante</h2>
        <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              {isOpen ? '🟢 Aberto — aceitando pedidos' : '🔴 Fechado — não aceita pedidos'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isOpen
                ? 'Clientes podem fazer pedidos agora'
                : 'Cardápio visível mas pedidos bloqueados'}
            </p>
          </div>
          <Switch checked={isOpen} onCheckedChange={setIsOpen} />
        </div>
      </section>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? 'Salvando...' : 'Salvar configurações'}
      </Button>
    </div>
  )
}
