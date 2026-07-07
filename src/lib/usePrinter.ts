// ── Hook de Impressão — Bluetooth + USB ─────────────────────────
// Suporte: Chrome Android (Bluetooth) e Chrome Desktop (USB)
// Compatível com impressoras térmicas 58mm e 80mm
// Protocolo ESC/POS (padrão Bematech, Epson, Elgin, etc.)

export interface PrinterConfig {
  connection: 'bluetooth' | 'usb' | 'none'
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
  delivery_fee: number
  created_at: string
  items: {
    product_name: string
    quantity: number
    unit_price: number
  }[]
}

// ── ESC/POS Commands ────────────────────────────────────────────
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
  CUT: [GS, 0x56, 0x42, 0x00],
  FEED: [LF],
}

function toBytes(cmds: number[][]): Uint8Array {
  const flat = cmds.flat()
  return new Uint8Array(flat)
}

function textBytes(text: string): number[] {
  // Converte string para bytes Latin-1 (compatível com impressoras térmicas)
  const bytes: number[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    bytes.push(code < 256 ? code : 0x3f) // '?' para chars não suportados
  }
  bytes.push(LF)
  return bytes
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function separator(width: number): number[] {
  return textBytes('-'.repeat(width))
}

function padLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length
  return left + ' '.repeat(Math.max(1, spaces)) + right
}

// ── Gera buffer ESC/POS do pedido ───────────────────────────────
export function buildReceiptBuffer(order: OrderToPrint, paperWidth: '58mm' | '80mm'): Uint8Array {
  const cols = paperWidth === '58mm' ? 32 : 48
  const subtotal = order.total - (order.delivery_fee || 0)

  const paymentLabel: Record<string, string> = {
    cash: 'Dinheiro', card: 'Cartao', pix: 'Pix',
  }

  const lines: number[][] = [
    CMD.INIT,
    CMD.ALIGN_CENTER,
    CMD.BOLD_ON,
    CMD.DOUBLE_HEIGHT_ON,
    textBytes('PEDIDO RECEBIDO'),
    CMD.DOUBLE_HEIGHT_OFF,
    CMD.BOLD_OFF,
    textBytes(formatTime(order.created_at)),
    CMD.FEED,
    CMD.ALIGN_LEFT,
    separator(cols),
    CMD.BOLD_ON,
    textBytes('CLIENTE'),
    CMD.BOLD_OFF,
    textBytes(order.customer_name),
    textBytes(`Tel: ${order.customer_phone || '-'}`),
    textBytes(`End: ${order.address}`),
    ...(order.neighborhood ? [textBytes(`Bairro: ${order.neighborhood}`)] : []),
    textBytes(`Pag: ${paymentLabel[order.payment_method] || order.payment_method}`),
    ...(order.notes ? [textBytes(`Obs: ${order.notes}`)] : []),
    separator(cols),
    CMD.BOLD_ON,
    textBytes('ITENS'),
    CMD.BOLD_OFF,
  ]

  for (const item of order.items) {
    const itemTotal = item.unit_price * item.quantity
    lines.push(textBytes(`${item.quantity}x ${item.product_name}`))
    lines.push(textBytes(padLine('', formatBRL(itemTotal), cols)))
  }

  lines.push(
    separator(cols),
    textBytes(padLine('Subtotal:', formatBRL(subtotal), cols)),
    textBytes(padLine('Entrega:', order.delivery_fee > 0 ? formatBRL(order.delivery_fee) : 'Gratis', cols)),
    CMD.BOLD_ON,
    textBytes(padLine('TOTAL:', formatBRL(order.total), cols)),
    CMD.BOLD_OFF,
    separator(cols),
    CMD.ALIGN_CENTER,
    textBytes('Obrigado pela preferencia!'),
    CMD.FEED,
    CMD.FEED,
    CMD.FEED,
    CMD.CUT,
  )

  return toBytes(lines)
}

// ── Estado global da conexão ────────────────────────────────────
let bluetoothDevice: any = null
let bluetoothChar: any = null
let usbDevice: any = null

// ── Conectar Bluetooth ───────────────────────────────────────────
export async function connectBluetooth(): Promise<string> {
  try {
    const nav = navigator as any
    if (!nav.bluetooth) throw new Error('Web Bluetooth não suportado neste navegador. Use o Chrome.')

    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Serial Port Profile
        '00001101-0000-1000-8000-00805f9b34fb', // SPP
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // comum em impressoras BT
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // outro perfil comum
      ],
    })

    const server = await device.gatt.connect()
    let char: any = null

    const serviceUUIDs = [
      '000018f0-0000-1000-8000-00805f9b34fb',
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    ]

    for (const uuid of serviceUUIDs) {
      try {
        const service = await server.getPrimaryService(uuid)
        const chars = await service.getCharacteristics()
        char = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
        if (char) break
      } catch {}
    }

    if (!char) {
      // Tenta pegar qualquer serviço disponível
      const services = await server.getPrimaryServices()
      for (const service of services) {
        const chars = await service.getCharacteristics()
        char = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
        if (char) break
      }
    }

    if (!char) throw new Error('Característica de escrita não encontrada. Verifique se a impressora está ligada.')

    bluetoothDevice = device
    bluetoothChar = char

    device.addEventListener('gattserverdisconnected', () => {
      bluetoothDevice = null
      bluetoothChar = null
    })

    return device.name || 'Impressora Bluetooth'
  } catch (err: any) {
    throw new Error(err.message || 'Erro ao conectar Bluetooth')
  }
}

// ── Conectar USB ─────────────────────────────────────────────────
export async function connectUSB(): Promise<string> {
  try {
    const nav = navigator as any
    if (!nav.usb) throw new Error('WebUSB não suportado neste navegador. Use o Chrome no PC.')

    const device = await nav.usb.requestDevice({ filters: [] })
    await device.open()

    if (device.configuration === null) await device.selectConfiguration(1)

    const iface = device.configuration.interfaces[0]
    await device.claimInterface(iface.interfaceNumber)

    usbDevice = device
    return device.productName || 'Impressora USB'
  } catch (err: any) {
    throw new Error(err.message || 'Erro ao conectar USB')
  }
}

// ── Imprimir ─────────────────────────────────────────────────────
export async function printOrder(order: OrderToPrint, config: PrinterConfig): Promise<void> {
  if (config.connection === 'none') return

  const buffer = buildReceiptBuffer(order, config.paperWidth)

  if (config.connection === 'bluetooth') {
    if (!bluetoothChar) throw new Error('Impressora Bluetooth não conectada. Vá em Configurações > Impressora e conecte.')

    // Envia em chunks de 512 bytes (limite BLE)
    const CHUNK = 512
    for (let i = 0; i < buffer.length; i += CHUNK) {
      const chunk = buffer.slice(i, i + CHUNK)
      if (bluetoothChar.properties.writeWithoutResponse) {
        await bluetoothChar.writeValueWithoutResponse(chunk)
      } else {
        await bluetoothChar.writeValue(chunk)
      }
      // Pequena pausa entre chunks para não sobrecarregar
      await new Promise(r => setTimeout(r, 20))
    }
    return
  }

  if (config.connection === 'usb') {
    if (!usbDevice) throw new Error('Impressora USB não conectada. Vá em Configurações > Impressora e conecte.')

    const iface = usbDevice.configuration.interfaces[0]
    const endpoint = iface.alternate.endpoints.find((e: any) => e.direction === 'out')
    if (!endpoint) throw new Error('Endpoint de saída não encontrado na impressora USB.')

    await usbDevice.transferOut(endpoint.endpointNumber, buffer)
    return
  }
}

export function isBluetoothConnected(): boolean {
  return !!bluetoothChar
}

export function isUsbConnected(): boolean {
  return !!usbDevice
}

export function getBluetoothDeviceName(): string {
  return bluetoothDevice?.name || ''
}

export function getUsbDeviceName(): string {
  return usbDevice?.productName || ''
}
