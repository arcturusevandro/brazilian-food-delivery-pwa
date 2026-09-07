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

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const CMD = {
  INIT: [ESC, 0x40], ALIGN_CENTER: [ESC, 0x61, 0x01], ALIGN_LEFT: [ESC, 0x61, 0x00],
  BOLD_ON: [ESC, 0x45, 0x01], BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [GS, 0x21, 0x10], DOUBLE_HEIGHT_OFF: [GS, 0x21, 0x00],
}

let bluetoothDevice: any = null
let bluetoothChar: any = null
let usbDevice: any = null

function toBytes(cmds: number[][]): Uint8Array { return new Uint8Array(cmds.flat()) }
function textBytes(text: string): number[] { const bytes: number[] = []; for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i); bytes.push(code < 256 ? code : 0x3f) }; bytes.push(LF); return bytes }
function formatBRL(value: number): string { return `R$ ${value.toFixed(2).replace('.', ',')}` }
function formatDateTime(iso: string): string { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
function separator(width: number): number[] { return textBytes('-'.repeat(width)) }

function buildReceiptBytes(order: OrderToPrint, config: PrinterConfig): Uint8Array {
  const width = config.paperWidth === '58mm' ? 32 : 48
  const chunks: number[][] = [CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT_ON]
  chunks.push(textBytes('NOVO PEDIDO'), CMD.DOUBLE_HEIGHT_OFF, CMD.BOLD_OFF)
  chunks.push(textBytes(`#${order.id.slice(0, 8).toUpperCase()}`), textBytes(formatDateTime(order.created_at)), separator(width), CMD.ALIGN_LEFT)
  chunks.push(CMD.BOLD_ON, textBytes(`Cliente: ${order.customer_name}`), CMD.BOLD_OFF)
  chunks.push(textBytes(`Telefone: ${order.customer_phone}`), textBytes(`Endereço: ${order.address}`))
  if (order.neighborhood) chunks.push(textBytes(`Bairro: ${order.neighborhood}`))
  chunks.push(separator(width))
  for (const item of order.items) { chunks.push(textBytes(`${item.quantity}x ${item.product_name}`), textBytes(`   ${formatBRL(item.quantity * item.unit_price)}`)) }
  chunks.push(separator(width))
  const deliveryFee = order.delivery_fee ?? 0
  if (deliveryFee > 0) chunks.push(textBytes(`Entrega: ${formatBRL(deliveryFee)}`))
  chunks.push(CMD.BOLD_ON, textBytes(`TOTAL: ${formatBRL(order.total)}`), CMD.BOLD_OFF, textBytes(`Pagamento: ${order.payment_method}`))
  if (order.notes) chunks.push(textBytes(`Obs: ${order.notes}`))
  chunks.push(separator(width), CMD.ALIGN_CENTER, textBytes('Obrigado!'), textBytes(''), textBytes(''))
  return toBytes(chunks)
}

export async function connectBluetooth(): Promise<string> {
  const nav = navigator as any
  if (!nav.bluetooth) throw new Error('Web Bluetooth não suportado. Use o Google Chrome.')
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
  })
  const server = await device.gatt.connect()
  let writable: any = null
  for (const uuid of ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455']) {
    try {
      const service = await server.getPrimaryService(uuid)
      const characteristics = await service.getCharacteristics()
      writable = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
      if (writable) break
    } catch {}
  }
  if (!writable) {
    const services = await server.getPrimaryServices()
    for (const service of services) {
      const characteristics = await service.getCharacteristics()
      writable = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
      if (writable) break
    }
  }
  if (!writable) throw new Error('Característica de escrita não encontrada. Verifique se a impressora está ligada.')
  bluetoothDevice = device
  bluetoothChar = writable
  device.addEventListener('gattserverdisconnected', () => { bluetoothDevice = null; bluetoothChar = null })
  return device.name || 'Impressora Bluetooth'
}

export async function connectUSB(): Promise<string> {
  const nav = navigator as any
  if (!nav.usb) throw new Error('WebUSB não suportado. Use o Google Chrome no computador.')
  const device = await nav.usb.requestDevice({ filters: [] })
  await device.open()
  if (device.configuration === null) await device.selectConfiguration(1)
  const iface = device.configuration.interfaces[0]
  await device.claimInterface(iface.interfaceNumber)
  usbDevice = device
  return device.productName || 'Impressora USB'
}

async function sendBluetoothBuffer(bytes: Uint8Array): Promise<void> {
  if (!bluetoothChar) throw new Error('Impressora Bluetooth não conectada. Configure em Impressora.')
  const chunkSize = 20
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize)
    if (bluetoothChar.properties.write) await bluetoothChar.writeValue(chunk)
    else if (bluetoothChar.properties.writeWithoutResponse) await bluetoothChar.writeValueWithoutResponse(chunk)
    else throw new Error('A conexão Bluetooth não permite enviar dados para esta impressora.')
    await new Promise<void>(resolve => setTimeout(resolve, 60))
  }
}

async function sendUSBBuffer(bytes: Uint8Array): Promise<void> {
  if (!usbDevice) throw new Error('Impressora USB não conectada. Configure em Impressora.')
  const iface = usbDevice.configuration.interfaces[0]
  const endpoint = iface.alternate.endpoints.find((e: any) => e.direction === 'out')
  if (!endpoint) throw new Error('Endpoint de saída não encontrado na impressora USB.')
  await usbDevice.transferOut(endpoint.endpointNumber, bytes)
}

function printBrowser(order: OrderToPrint, config: PrinterConfig) {
  const width = config.paperWidth === '58mm' ? '58mm' : '80mm'
  const deliveryFee = order.delivery_fee ?? 0
  const itemsHtml = order.items.map(item => `<div class="row"><span>${item.quantity}x ${item.product_name}</span><span>${formatBRL(item.quantity * item.unit_price)}</span></div>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pedido</title><style>@page{size:${width} auto;margin:3mm}body{font-family:monospace;font-size:12px;margin:0;color:#000}.sep{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;gap:8px;margin:2px 0}.bold{font-weight:700}h1{text-align:center;font-size:18px}</style></head><body><h1>NOVO PEDIDO</h1><div>${formatDateTime(order.created_at)}</div><div class="sep"></div><div><b>Cliente:</b> ${order.customer_name}</div><div><b>Telefone:</b> ${order.customer_phone}</div><div><b>Endereço:</b> ${order.address}</div>${order.neighborhood ? `<div><b>Bairro:</b> ${order.neighborhood}</div>` : ''}<div class="sep"></div>${itemsHtml}<div class="sep"></div>${deliveryFee > 0 ? `<div class="row"><span>Entrega</span><span>${formatBRL(deliveryFee)}</span></div>` : ''}<div class="row bold"><span>TOTAL</span><span>${formatBRL(order.total)}</span></div><div><b>Pagamento:</b> ${order.payment_method}</div>${order.notes ? `<div><b>Obs:</b> ${order.notes}</div>` : ''}<div class="sep"></div><div>Obrigado!</div></body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) { iframe.remove(); throw new Error('Iframe não disponível para impressão.') }
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 2000) }, 300)
}

export async function printOrder(order: OrderToPrint, config: PrinterConfig): Promise<void> {
  if (config.connection === 'none') return
  if (config.connection === 'wifi') { printBrowser(order, config); return }
  const bytes = buildReceiptBytes(order, config)
  if (config.connection === 'bluetooth') await sendBluetoothBuffer(bytes)
  else if (config.connection === 'usb') await sendUSBBuffer(bytes)
}

export const isBluetoothConnected = () => Boolean(bluetoothChar)
export const isUsbConnected = () => Boolean(usbDevice)
export const getBluetoothDeviceName = () => bluetoothDevice?.name || ''
export const getUsbDeviceName = () => usbDevice?.productName || ''
