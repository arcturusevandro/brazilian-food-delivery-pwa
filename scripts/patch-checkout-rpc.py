from pathlib import Path

path = Path('src/routes/index.tsx')
text = path.read_text()
start_marker = '  const submitOrder = useCallback'
end_marker = '  const productsByCategory = useMemo'

if text.count(start_marker) != 1 or text.count(end_marker) != 1:
    raise SystemExit('Checkout markers are not unique; refusing to modify the file.')

start = text.index(start_marker)
end = text.index(end_marker)
if end <= start:
    raise SystemExit('Checkout markers are out of order; refusing to modify the file.')

replacement = '''  const submitOrder = useCallback(async (form: CheckoutForm, _deliveryFee: number) => {
    if (!restaurant || cart.length === 0) return
    if (!restaurant.is_open) { alert('O restaurante está fechado no momento. Tente novamente mais tarde.'); return }
    setSubmitting(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      if (!sd.session) { const { error: ae } = await supabase.auth.signInAnonymously(); if (ae) throw ae }
      let notes = form.notes || ''
      if (form.payment_method === 'cash' && form.change_for.trim()) {
        const t = `Troco para: R$ ${form.change_for}`; notes = notes ? `${t} | ${notes}` : t
      }
      const rpcItems = cart.map(i => ({
        product_id: i.product.id,
        quantity: i.quantity,
        addon_ids: i.addons.map(a => a.id),
      }))
      const { data, error } = await supabase.rpc('create_order', {
        p_restaurant_id: restaurant.id,
        p_customer_name: form.customer_name,
        p_customer_phone: form.customer_phone,
        p_address: form.address,
        p_neighborhood: form.neighborhood || '',
        p_payment_method: form.payment_method,
        p_notes: notes || '',
        p_items: rpcItems,
      })
      if (error) throw error
      const result = data as { order_id: string; total: number | string; delivery_fee: number | string }
      const total = Number(result.total)
      const deliveryFee = Number(result.delivery_fee)
      if (!result.order_id || !Number.isFinite(total) || !Number.isFinite(deliveryFee)) throw new Error('Resposta inválida ao criar pedido.')
      setCart([])
      setCheckoutOpen(false)
      setOrderConfirmed({ id: result.order_id, total, deliveryFee })
    } catch (err: any) {
      alert(`Erro ao fazer pedido: ${err.message || 'Tente novamente.'}`)
    } finally { setSubmitting(false) }
  }, [restaurant, cart])

'''

path.write_text(text[:start] + replacement + text[end:])
print('Checkout block replaced safely.')
