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
  delivery_fee: number
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

function padLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length
  return left + ' '.repeat(Math.max(1, spaces)) + right
}

// ── Buffer ESC/POS (Bluetooth + USB) ────────────────────────────

export function buildReceiptBuffer(
  order: OrderToPrint,
  paperWidth: '58mm' | '80mm',
): Uint8Array {
  const cols = paperWidth === '58mm' ? 32 : 48
  const subtotal = order.total - (order.delivery_fee || 0)

  const paymentLabel: Record<string, string> = {
    cash: 'Dinheiro',
    card: 'Cartao',
    pix: 'Pix',
  }

  const lines: number[][] = [
    CMD.INIT,
    CMD.ALIGN_CENTER,
    CMD.BOLD_ON,
    CMD.DOUBLE_HEIGHT_ON,
    textBytes('PEDIDO RECEBIDO'),
    CMD.DOUBLE_HEIGHT_OFF,
    CMD.BOLD_OFF,
    textBytes(formatDateTime(order.created_at)),
    CMD.FEED,

    CMD.ALIGN_LEFT,
    separator(cols),

    CMD.BOLD_ON,
    textBytes('CLIENTE'),
    CMD.BOLD_OFF,

    textBytes(order.customer_name),
    textBytes(`Tel: ${order.customer_phone || '-'}`),
    textBytes(`End: ${order.address}`),

    ...(order.neighborhood
      ? [textBytes(`Bairro: ${order.neighborhood}`)]
      : []),

    textBytes(
      `Pag: ${
        paymentLabel[order.payment_method] || order.payment_method
      }`,
    ),

    ...(order.notes
      ? [textBytes(`Obs: ${order.notes}`)]
      : []),

    separator(cols),

    CMD.BOLD_ON,
    textBytes('ITENS'),
    CMD.BOLD_OFF,
  ]

  for (const item of order.items) {
    lines.push(
      textBytes(`${item.quantity}x ${item.product_name}`),
    )

    lines.push(
      textBytes(
        padLine(
          '',
          formatBRL(item.unit_price * item.quantity),
          cols,
        ),
      ),
    )
  }

  lines.push(
    separator(cols),

    textBytes(
      padLine(
        'Subtotal:',
        formatBRL(subtotal),
        cols,
      ),
    ),

    textBytes(
      padLine(
        'Entrega:',
        order.delivery_fee > 0
          ? formatBRL(order.delivery_fee)
          : 'Gratis',
        cols,
      ),
    ),

    CMD.BOLD_ON,

    textBytes(
      padLine(
        'TOTAL:',
        formatBRL(order.total),
        cols,
      ),
    ),

    CMD.BOLD_OFF,
    separator(cols),

    CMD.ALIGN_CENTER,
    textBytes('Obrigado pela preferencia!'),

    CMD.FEED,
    CMD.FEED,
    CMD.FEED,
  )

  return toBytes(lines)
}

// ── HTML do cupom (WiFi/iframe) ──────────────────────────────────

function buildReceiptHTML(
  order: OrderToPrint,
  paperWidth: '58mm' | '80mm',
): string {
  const width = paperWidth === '58mm' ? '58mm' : '80mm'
  const fontSize = paperWidth === '58mm' ? '11px' : '12px'
  const subtotal = order.total - (order.delivery_fee || 0)

  const paymentLabel: Record<string, string> = {
    cash: 'Dinheiro',
    card: 'Cartão',
    pix: 'Pix',
  }

  const itemsHTML = order.items
    .map(
      (item) => `
        <tr>
          <td>${item.quantity}x ${item.product_name}</td>
          <td align="right">
            ${formatBRL(item.unit_price * item.quantity)}
          </td>
        </tr>
      `,
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />

        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Courier New', monospace;
            font-size: ${fontSize};
            width: ${width};
            max-width: ${width};
            padding: 4px;
            color: #000;
            background: #fff;
          }

          .center {
            text-align: center;
          }

          .bold {
            font-weight: bold;
          }

          .big {
            font-size: 14px;
            font-weight: bold;
          }

          .sep {
            border-top: 1px dashed #000;
            margin: 4px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          td {
            padding: 1px 0;
          }

          .total-row td {
            font-weight: bold;
            font-size: 13px;
            border-top: 1px dashed #000;
            padding-top: 3px;
          }

          .obs {
            background: #f5f5f5;
            padding: 3px 4px;
            border-radius: 2px;
            margin: 3px 0;
          }

          @media print {
            body {
              width: ${width};
            }

            @page {
              margin: 0;
              size: ${width} auto;
            }
          }
        </style>
      </head>

      <body>
        <div class="center big">
          PEDIDO RECEBIDO
        </div>

        <div class="center">
          ${formatDateTime(order.created_at)}
        </div>

        <div class="sep"></div>

        <div class="bold">
          CLIENTE
        </div>

        <div>
          ${order.customer_name}
        </div>

        <div>
          Tel: ${order.customer_phone || '-'}
        </div>

        <div>
          End: ${order.address}
          ${
            order.neighborhood
              ? ` — ${order.neighborhood}`
              : ''
          }
        </div>

        <div>
          Pag:
          ${
            paymentLabel[order.payment_method] ||
            order.payment_method
          }
        </div>

        ${
          order.notes
            ? `<div class="obs">Obs: ${order.notes}</div>`
            : ''
        }

        <div class="sep"></div>

        <div class="bold">
          ITENS
        </div>

        <table>
          ${itemsHTML}
        </table>

        <div class="sep"></div>

        <table>
          <tr>
            <td>Subtotal:</td>

            <td align="right">
              ${formatBRL(subtotal)}
            </td>
          </tr>

          <tr>
            <td>Entrega:</td>

            <td align="right">
              ${
                order.delivery_fee > 0
                  ? formatBRL(order.delivery_fee)
                  : 'Grátis'
              }
            </td>
          </tr>

          <tr class="total-row">
            <td>TOTAL:</td>

            <td align="right">
              ${formatBRL(order.total)}
            </td>
          </tr>
        </table>

        <div class="sep"></div>

        <div class="center">
          Obrigado pela preferencia!
        </div>
      </body>
    </html>
  `
}

// ── Impressão WiFi via iframe ────────────────────────────────────

function printViaIframe(
  order: OrderToPrint,
  paperWidth: '58mm' | '80mm',
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const existing =
        document.getElementById('__print_frame__')

      if (existing) {
        existing.remove()
      }

      const iframe = document.createElement('iframe')

      iframe.id = '__print_frame__'

      iframe.style.cssText =
        'position:fixed;' +
        'top:-9999px;' +
        'left:-9999px;' +
        'width:1px;' +
        'height:1px;' +
        'border:none;' +
        'visibility:hidden;'

      document.body.appendChild(iframe)

      const html = buildReceiptHTML(order, paperWidth)

      const doc =
        iframe.contentDocument ||
        iframe.contentWindow?.document

      if (!doc) {
        reject(
          new Error(
            'Iframe não disponível para impressão.',
          ),
        )

        return
      }

      doc.open()
      doc.write(html)
      doc.close()

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()

            setTimeout(() => {
              iframe.remove()
            }, 2000)

            resolve()
          } catch (error: any) {
            reject(
              new Error(
                `Erro ao imprimir: ${error.message}`,
              ),
            )
          }
        }, 300)
      }
    } catch (error: any) {
      reject(
        new Error(
          `Erro ao preparar impressão: ${error.message}`,
        ),
      )
    }
  })
}

// ── Estado global de conexão ─────────────────────────────────────

let bluetoothDevice: any = null
let bluetoothChar: any = null
let usbDevice: any = null

// ── Conectar Bluetooth ───────────────────────────────────────────

export async function connectBluetooth(): Promise<string> {
  const nav = navigator as any

  if (!nav.bluetooth) {
    throw new Error(
      'Web Bluetooth não suportado. Use o Google Chrome.',
    )
  }

  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,

    optionalServices: [
      '000018f0-0000-1000-8000-00805f9b34fb',
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
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
      const service =
        await server.getPrimaryService(uuid)

      const characteristics =
        await service.getCharacteristics()

      char = characteristics.find(
        (characteristic: any) =>
          characteristic.properties.write ||
          characteristic.properties.writeWithoutResponse,
      )

      if (char) {
        break
      }
    } catch {
      // Continua procurando em outro serviço.
    }
  }

  if (!char) {
    const services =
      await server.getPrimaryServices()

    for (const service of services) {
      const characteristics =
        await service.getCharacteristics()

      char = characteristics.find(
        (characteristic: any) =>
          characteristic.properties.write ||
          characteristic.properties.writeWithoutResponse,
      )

      if (char) {
        break
      }
    }
  }

  if (!char) {
    throw new Error(
      'Característica de escrita não encontrada. Verifique se a impressora está ligada.',
    )
  }

  bluetoothDevice = device
  bluetoothChar = char

  device.addEventListener(
    'gattserverdisconnected',
    () => {
      bluetoothDevice = null
      bluetoothChar = null
    },
  )

  return device.name || 'Impressora Bluetooth'
}

// ── Conectar USB ─────────────────────────────────────────────────

export async function connectUSB(): Promise<string> {
  const nav = navigator as any

  if (!nav.usb) {
    throw new Error(
      'WebUSB não suportado. Use o Google Chrome no computador.',
    )
  }

  const device =
    await nav.usb.requestDevice({
      filters: [],
    })

  await device.open()

  if (device.configuration === null) {
    await device.selectConfiguration(1)
  }

  const iface =
    device.configuration.interfaces[0]

  await device.claimInterface(
    iface.interfaceNumber,
  )

  usbDevice = device

  return (
    device.productName ||
    'Impressora USB'
  )
}

// ── Envio Bluetooth em blocos ────────────────────────────────────

async function sendBluetoothBuffer(
  buffer: Uint8Array,
): Promise<void> {
  if (!bluetoothChar) {
    throw new Error(
      'Impressora Bluetooth não conectada. Configure em Impressora.',
    )
  }

  /*
   * A TC-163 / JK-5802 usa Bluetooth BLE e possui
   * um buffer pequeno.
   *
   * O envio anterior usava blocos de 512 bytes,
   * fazendo a impressora descartar parte do cupom.
   *
   * Blocos de 20 bytes são compatíveis com o MTU
   * padrão do Bluetooth Low Energy.
   */
  const CHUNK_SIZE = 20
  const CHUNK_DELAY_MS = 60

  for (
    let offset = 0;
    offset < buffer.length;
    offset += CHUNK_SIZE
  ) {
    const chunk = buffer.slice(
      offset,
      offset + CHUNK_SIZE,
    )

    /*
     * Prioriza escrita com resposta para confirmar
     * que cada bloco foi recebido pela impressora.
     */
    if (bluetoothChar.properties.write) {
      await bluetoothChar.writeValue(chunk)
    } else if (
      bluetoothChar.properties.writeWithoutResponse
    ) {
      await bluetoothChar.writeValueWithoutResponse(
        chunk,
      )
    } else {
      throw new Error(
        'A conexão Bluetooth não permite enviar dados para esta impressora.',
      )
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, CHUNK_DELAY_MS)
    })
  }
}

// ── Imprimir ─────────────────────────────────────────────────────

export async function printOrder(
  order: OrderToPrint,
  config: PrinterConfig,
): Promise<void> {
  if (config.connection === 'none') {
    return
  }

  if (config.connection === 'wifi') {
    await printViaIframe(
      order,
      config.paperWidth,
    )

    return
  }

  const buffer = buildReceiptBuffer(
    order,
    config.paperWidth,
  )

  if (config.connection === 'bluetooth') {
    await sendBluetoothBuffer(buffer)
    return
  }

  if (config.connection === 'usb') {
    if (!usbDevice) {
      throw new Error(
        'Impressora USB não conectada. Configure em Impressora.',
      )
    }

    const iface =
      usbDevice.configuration.interfaces[0]

    const endpoint =
      iface.alternate.endpoints.find(
        (item: any) =>
          item.direction === 'out',
      )

    if (!endpoint) {
      throw new Error(
        'Endpoint de saída não encontrado na impressora USB.',
      )
    }

    await usbDevice.transferOut(
      endpoint.endpointNumber,
      buffer,
    )
  }
}

// ── Estado da impressora ─────────────────────────────────────────

export const isBluetoothConnected = () =>
  Boolean(bluetoothChar)

export const isUsbConnected = () =>
  Boolean(usbDevice)

export const getBluetoothDeviceName = () =>
  bluetoothDevice?.name || ''

export const getUsbDeviceName = () =>
  usbDevice?.productName || ''