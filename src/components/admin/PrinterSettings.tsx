import { useState, useEffect } from 'react'
import { Button, Label, Switch, Skeleton } from '@blinkdotnew/ui'
import { Printer, Bluetooth, Usb, CheckCircle, XCircle } from 'lucide-react'
import {
  connectBluetooth, connectUSB, isBluetoothConnected, isUsbConnected,
  getBluetoothDeviceName, getUsbDeviceName, PrinterConfig,
} from '@/lib/usePrinter'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'printer_config'

function loadConfig(): PrinterConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { connection: 'none', paperWidth: '80mm', autoprint: false }
}

function saveConfig(config: PrinterConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function usePrinterConfig(): PrinterConfig {
  return loadConfig()
}

export function PrinterSettings() {
  const [config, setConfig] = useState<PrinterConfig>(loadConfig)
  const [btConnected, setBtConnected] = useState(isBluetoothConnected())
  const [usbConnected, setUsbConnected] = useState(isUsbConnected())
  const [connecting, setConnecting] = useState(false)

  const update = (partial: Partial<PrinterConfig>) => {
    const next = { ...config, ...partial }
    setConfig(next)
    saveConfig(next)
  }

  const handleConnectBluetooth = async () => {
    setConnecting(true)
    try {
      const name = await connectBluetooth()
      setBtConnected(true)
      update({ connection: 'bluetooth' })
      toast.success(`Conectado: ${name}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setConnecting(false)
    }
  }

  const handleConnectUSB = async () => {
    setConnecting(true)
    try {
      const name = await connectUSB()
      setUsbConnected(true)
      update({ connection: 'usb' })
      toast.success(`Conectado: ${name}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tipo de conexão</h2>

        {/* Sem impressora */}
        <button
          type="button"
          onClick={() => update({ connection: 'none', autoprint: false })}
          className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${config.connection === 'none' ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'}`}
        >
          <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${config.connection === 'none' ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
          <div>
            <p className="text-sm font-medium">Sem impressora</p>
            <p className="text-xs text-muted-foreground">Não imprimir pedidos</p>
          </div>
        </button>

        {/* Bluetooth */}
        <div className={`rounded-lg border px-4 py-3 space-y-3 transition-all ${config.connection === 'bluetooth' ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}>
          <button
            type="button"
            onClick={() => update({ connection: 'bluetooth' })}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${config.connection === 'bluetooth' ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
            <Bluetooth className="h-4 w-4 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">Bluetooth</p>
              <p className="text-xs text-muted-foreground">Chrome Android/Desktop — pareamento único</p>
            </div>
            {btConnected ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
          </button>
          {config.connection === 'bluetooth' && (
            <Button
              size="sm"
              variant={btConnected ? 'outline' : 'default'}
              onClick={handleConnectBluetooth}
              disabled={connecting}
              className="w-full gap-2"
            >
              <Bluetooth className="h-3.5 w-3.5" />
              {connecting ? 'Conectando...' : btConnected ? `Reconectar (${getBluetoothDeviceName()})` : 'Conectar impressora Bluetooth'}
            </Button>
          )}
        </div>

        {/* USB */}
        <div className={`rounded-lg border px-4 py-3 space-y-3 transition-all ${config.connection === 'usb' ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}>
          <button
            type="button"
            onClick={() => update({ connection: 'usb' })}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${config.connection === 'usb' ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
            <Usb className="h-4 w-4 text-orange-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">USB (cabo)</p>
              <p className="text-xs text-muted-foreground">Chrome no PC — Bematech, Epson, Elgin</p>
            </div>
            {usbConnected ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
          </button>
          {config.connection === 'usb' && (
            <Button
              size="sm"
              variant={usbConnected ? 'outline' : 'default'}
              onClick={handleConnectUSB}
              disabled={connecting}
              className="w-full gap-2"
            >
              <Usb className="h-3.5 w-3.5" />
              {connecting ? 'Conectando...' : usbConnected ? `Reconectar (${getUsbDeviceName()})` : 'Conectar impressora USB'}
            </Button>
          )}
        </div>
      </section>

      {/* Largura do papel */}
      {config.connection !== 'none' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Largura do papel</h2>
          <div className="grid grid-cols-2 gap-2">
            {(['58mm', '80mm'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => update({ paperWidth: w })}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-4 py-3 transition-all ${config.paperWidth === w ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}
              >
                <Printer className="h-5 w-5" />
                <span className="text-sm font-medium">{w}</span>
                <span className="text-xs">{w === '58mm' ? '32 colunas' : '48 colunas'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Impressão automática */}
      {config.connection !== 'none' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Impressão automática</h2>
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <div>
              <p className="text-sm font-medium">Imprimir ao receber pedido</p>
              <p className="text-xs text-muted-foreground">
                {config.autoprint
                  ? 'Imprime automaticamente. Botão "Iniciar Preparo" só muda o status.'
                  : 'Botão "Iniciar Preparo" imprime e muda o status.'}
              </p>
            </div>
            <Switch
              checked={config.autoprint}
              onCheckedChange={(v) => update({ autoprint: v })}
            />
          </div>
        </section>
      )}

      <div className="rounded-lg bg-accent px-4 py-3 space-y-1">
        <p className="text-xs font-medium text-accent-foreground">⚠️ Requisitos</p>
        <p className="text-xs text-muted-foreground">Use o Google Chrome. Bluetooth funciona no Android e PC. USB funciona no PC. iOS não é suportado.</p>
      </div>
    </div>
  )
}
