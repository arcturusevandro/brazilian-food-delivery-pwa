// ── Hook de Impressão — Bluetooth + USB + WiFi (iframe silencioso) ──
// Bluetooth: Web Bluetooth API — Chrome Android/Desktop
// USB: WebUSB API — Chrome Desktop
// WiFi/Padrão: iframe oculto + window.print() — qualquer navegador

export interface PrinterConfig {
  connection: 'bluetooth' | 'usb' | 'wifi' | 'none'
  paperWidth: '58mm' | '80mm'
  autoprint: boolean
}

export interface OrderToPrint {
  id: string
  customer_name: string
  customer_phone: string
  address: string
  neighborhood: string | null
  payment_method: string
  notes: string | null
  total: number
  delivery_fee: number | null
  created_at: string
  items: {
    product_name: string
    quantity: number
    unit_price: number
  }[]
}

// ── ESC/POS Commands (Bluetooth + USB) ──────────────────────────

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const CMD = {
  INIT: [ESC, 0x40],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [GS, 0x21, 0x10],
  DOUBLE_HEIGHT_OFF: [GS, 0x21, 0x00],
  FEED: [LF],
}

function toBytes(cmds: number[][]): Uint8Array {
  return new Uint8Array(cmds.flat())
}

function textBytes(text: string): number[] {
  const bytes: number[] = []

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    bytes.push(code < 256 ? code : 0x3f)
  }

  bytes.push(LF)

  return bytes
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function separator(width: number): number[] {
  return textBytes('-'.repeat(width))
}

function buildReceiptBytes(order: OrderToPrint, config: PrinterConfig): Uint8Array {
  const width = config.paperWidth === '58mm' ? 32 : 48
  const chunks: number[][] = [CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT_ON]

  chunks.push(textBytes('NOVO PEDIDO'))
  chunks.push(CMD.DOUBLE_HEIGHT_OFF, CMD.BOLD_OFF)
  chunks.push(textBytes(`#${order.id.slice(0, 8).toUpperCase()}`))
  chunks.push(textBytes(formatDateTime(order.created_at)))
  chunks.push(separator(width), CMD.ALIGN_LEFT)
  chunks.push(CMD.BOLD_ON, textBytes(`Cliente: ${order.customer_name}`), CMD.BOLD_OFF)
  chunks.push(textBytes(`Telefone: ${order.customer_phone}`))
  chunks.push(textBytes(`Endereço: ${order.address}`))
  if (order.neighborhood) chunks.push(textBytes(`Bairro: ${order.neighborhood}`))
  chunks.push(separator(width))

  for (const item of order.items) {
    chunks.push(textBytes(`${item.quantity}x ${item.product_name}`))
    chunks.push(textBytes(`   ${formatBRL(item.quantity * item.unit_price)}`))
  }

  chunks.push(separator(width))
  const deliveryFee = order.delivery_fee ?? 0
  if (deliveryFee > 0) chunks.push(textBytes(`Entrega: ${formatBRL(deliveryFee)}`))
  chunks.push(CMD.BOLD_ON, textBytes(`TOTAL: ${formatBRL(order.total)}`), CMD.BOLD_OFF)
  chunks.push(textBytes(`Pagamento: ${order.payment_method}`))
  if (order.notes) chunks.push(textBytes(`Obs: ${order.notes}`))
  chunks.push(separator(width), CMD.ALIGN_CENTER, textBytes('Obrigado!'), textBytes(''), textBytes(''))

  return toBytes(chunks)
}

async function printBluetooth(bytes: Uint8Array) {
  const nav = navigator as any
  const device = await nav.bluetooth.requestDevice({
    filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
  })
  const server = await device.gatt.connect()
  const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
  const characteristics = await service.getCharacteristics()
  const writable = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
  if (!writable) throw new Error('Nenhuma característica de escrita encontrada')

  const chunkSize = 180
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize)
    if (writable.properties.writeWithoutResponse) await writable.writeValueWithoutResponse(chunk)
    else await writable.writeValue(chunk)
  }
}

async function printUSB(bytes: Uint8Array) {
  const nav = navigator as any
  const device = await nav.usb.requestDevice({ filters: [] })
  await device.open()
  if (device.configuration === null) await device.selectConfiguration(1)
  const iface = device.configuration.interfaces[0]
  await device.claimInterface(iface.interfaceNumber)
  const endpoint = iface.alternate.endpoints.find((e: any) => e.direction === 'out')
  if (!endpoint) throw new Error('Endpoint de saída não encontrado')
  await device.transferOut(endpoint.endpointNumber, bytes)
  await device.close()
}

function printBrowser(order: OrderToPrint, config: PrinterConfig) {
  const width = config.paperWidth === '58mm' ? '58mm' : '80mm'
  const deliveryFee = order.delivery_fee ?? 0
  const itemsHtml = order.items.map(item => `
    <div class="row"><span>${item.quantity}x ${item.product_name}</span><span>${formatBRL(item.quantity * item.unit_price)}</span></div>
  `).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pedido</title><style>
    @page { size: ${width} auto; margin: 3mm; }
    body { font-family: monospace; font-size: 12px; margin: 0; color: #000; }
    h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
    .center { text-align: center; }
    .sep { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    .bold { font-weight: 700; }
  </style></head><body>
    <h1>NOVO PEDIDO</h1>
    <div class="center">#${order.id.slice(0, 8).toUpperCase()}</div>
    <div class="center">${formatDateTime(order.created_at)}</div>
    <div class="sep"></div>
    <div><b>Cliente:</b> ${order.customer_name}</div>
    <div><b>Telefone:</b> ${order.customer_phone}</div>
    <div><b>Endereço:</b> ${order.address}</div>
    ${order.neighborhood ? `<div><b>Bairro:</b> ${order.neighborhood}</div>` : ''}
    <div class="sep"></div>
    ${itemsHtml}
    <div class="sep"></div>
    ${deliveryFee > 0 ? `<div class="row"><span>Entrega</span><span>${formatBRL(deliveryFee)}</span></div>` : ''}
    <div class="row bold"><span>TOTAL</span><span>${formatBRL(order.total)}</span></div>
    <div><b>Pagamento:</b> ${order.payment_method}</div>
    ${order.notes ? `<div><b>Obs:</b> ${order.notes}</div>` : ''}
    <div class="sep"></div>
    <div class="center">Obrigado!</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
  </body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => document.body.removeChild(iframe), 3000)
  }
  document.body.appendChild(iframe)
}

export async function printOrder(order: OrderToPrint, config: PrinterConfig): Promise<void> {
  if (config.connection === 'none') throw new Error('Nenhuma impressora configurada')

  if (config.connection === 'wifi') {
    printBrowser(order, config)
    return
  }

  const bytes = buildReceiptBytes(order, config)
  if (config.connection === 'bluetooth') await printBluetooth(bytes)
  else if (config.connection === 'usb') await printUSB(bytes)
}
