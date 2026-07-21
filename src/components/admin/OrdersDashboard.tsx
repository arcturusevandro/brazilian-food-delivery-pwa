import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Skeleton,
} from '@blinkdotnew/ui'
import {
  Package,
  Clock,
  MapPin,
  Phone,
  CreditCard,
  ChefHat,
  Bike,
  CheckCircle,
  Volume2,
  VolumeX,
  Printer,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  printOrder,
  PrinterConfig,
} from '@/lib/usePrinter'

type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'

interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
}

interface Order {
  id: string
  restaurant_id: string
  customer_name: string
  customer_phone: string
  address: string
  neighborhood: string | null
  payment_method: string
  status: OrderStatus
  total: number
  delivery_fee: number | null
  notes: string | null
  created_at: string
  items?: OrderItem[]
}

interface OrdersDashboardProps {
  restaurantId: string
}

const STATUS_MAP: Record<
  OrderStatus,
  {
    label: string
    variant:
      | 'default'
      | 'secondary'
      | 'outline'
      | 'destructive'
    icon: React.ReactNode
  }
> = {
  pending: {
    label: 'Pendente',
    variant: 'destructive',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  preparing: {
    label: 'Preparando',
    variant: 'secondary',
    icon: <ChefHat className="h-3.5 w-3.5" />,
  },
  out_for_delivery: {
    label: 'Saiu p/ Entrega',
    variant: 'outline',
    icon: <Bike className="h-3.5 w-3.5" />,
  },
  delivered: {
    label: 'Entregue',
    variant: 'default',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
}

const STATUS_NEXT: Record<
  OrderStatus,
  OrderStatus | null
> = {
  pending: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: null,
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Dinheiro',
  card: 'Cartão',
  pix: 'Pix',
}

const SOUND_STORAGE_PREFIX =
  'orders_sound_enabled'

function getSoundStorageKey(
  restaurantId: string,
): string {
  return `${SOUND_STORAGE_PREFIX}_${restaurantId}`
}

function loadSoundPreference(
  restaurantId: string,
): boolean {
  try {
    return (
      localStorage.getItem(
        getSoundStorageKey(restaurantId),
      ) === 'true'
    )
  } catch {
    return false
  }
}

function saveSoundPreference(
  restaurantId: string,
  enabled: boolean,
): void {
  try {
    localStorage.setItem(
      getSoundStorageKey(restaurantId),
      enabled ? 'true' : 'false',
    )
  } catch {
    // Ignora erro quando o armazenamento
    // do navegador não estiver disponível.
  }
}

function formatBRL(value: number): string {
  return `R$ ${value
    .toFixed(2)
    .replace('.', ',')}`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  )
}

// ─────────────────────────────────────────────
// Toque de telefone antigo
// ─────────────────────────────────────────────

let ringerCtx: AudioContext | null = null

let ringerInterval:
  | ReturnType<typeof setInterval>
  | null = null

let ringerActive = false

function getRingerCtx(): AudioContext {
  if (
    !ringerCtx ||
    ringerCtx.state === 'closed'
  ) {
    ringerCtx = new (
      window.AudioContext ||
      (window as any).webkitAudioContext
    )()
  }

  return ringerCtx
}

function playRingCycle() {
  try {
    const ctx = getRingerCtx()

    void ctx.resume()

    const now = ctx.currentTime

    const makeTone = (
      frequency: number,
      start: number,
      duration: number,
    ) => {
      const oscillator =
        ctx.createOscillator()

      const gain = ctx.createGain()

      oscillator.connect(gain)
      gain.connect(ctx.destination)

      oscillator.type = 'sawtooth'
      oscillator.frequency.value = frequency

      gain.gain.setValueAtTime(
        0,
        now + start,
      )

      gain.gain.linearRampToValueAtTime(
        0.35,
        now + start + 0.01,
      )

      gain.gain.setValueAtTime(
        0.35,
        now + start + duration - 0.02,
      )

      gain.gain.linearRampToValueAtTime(
        0,
        now + start + duration,
      )

      oscillator.start(now + start)

      oscillator.stop(
        now + start + duration + 0.02,
      )
    }

    makeTone(440, 0, 0.18)
    makeTone(480, 0.02, 0.18)

    makeTone(440, 0.2, 0.18)
    makeTone(480, 0.22, 0.18)

    makeTone(440, 0.55, 0.18)
    makeTone(480, 0.57, 0.18)

    makeTone(440, 0.75, 0.18)
    makeTone(480, 0.77, 0.18)
  } catch {
    // Evita quebrar o painel caso o navegador
    // bloqueie temporariamente o áudio.
  }
}

function startRinger() {
  if (ringerActive) {
    return
  }

  ringerActive = true

  playRingCycle()

  ringerInterval = setInterval(
    playRingCycle,
    2200,
  )
}

function stopRinger() {
  ringerActive = false

  if (ringerInterval) {
    clearInterval(ringerInterval)
    ringerInterval = null
  }
}

function unlockAudio() {
  try {
    const context = getRingerCtx()

    void context.resume()
  } catch {
    // Ignora navegadores sem suporte.
  }
}

function testRing() {
  try {
    const context = getRingerCtx()

    void context.resume().then(() => {
      playRingCycle()
    })
  } catch {
    // Ignora navegadores sem suporte.
  }
}

// ─────────────────────────────────────────────
// Impressora
// ─────────────────────────────────────────────

function loadPrinterConfig(): PrinterConfig {
  try {
    const saved =
      localStorage.getItem('printer_config')

    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // Usa configuração padrão.
  }

  return {
    connection: 'none',
    paperWidth: '80mm',
    autoprint: false,
  }
}

export function OrdersDashboard({
  restaurantId,
}: OrdersDashboardProps) {
  const initialSoundEnabled =
    loadSoundPreference(restaurantId)

  const [orders, setOrders] =
    useState<Order[]>([])

  const [loading, setLoading] =
    useState(true)

  const [lastUpdate, setLastUpdate] =
    useState<Date>(new Date())

  const [soundEnabled, setSoundEnabled] =
    useState(initialSoundEnabled)

  const [isRinging, setIsRinging] =
    useState(false)

  const scrollRef =
    useRef<HTMLDivElement>(null)

  const prevIdsRef =
    useRef<Set<string>>(new Set())

  const soundEnabledRef =
    useRef(initialSoundEnabled)

  const printerConfigRef =
    useRef<PrinterConfig>(
      loadPrinterConfig(),
    )

  // Recupera a preferência de som sempre que
  // o restaurante atual mudar.
  useEffect(() => {
    const enabled =
      loadSoundPreference(restaurantId)

    soundEnabledRef.current = enabled
    setSoundEnabled(enabled)

    if (!enabled) {
      stopRinger()
      setIsRinging(false)
    }
  }, [restaurantId])

  // Quando o som estiver ativo, qualquer toque
  // ou clique no painel desbloqueia o áudio do
  // navegador automaticamente.
  useEffect(() => {
    if (!soundEnabled) {
      return
    }

    const handleInteraction = () => {
      unlockAudio()
    }

    window.addEventListener(
      'pointerdown',
      handleInteraction,
    )

    window.addEventListener(
      'keydown',
      handleInteraction,
    )

    return () => {
      window.removeEventListener(
        'pointerdown',
        handleInteraction,
      )

      window.removeEventListener(
        'keydown',
        handleInteraction,
      )
    }
  }, [soundEnabled])

  // Atualiza a configuração da impressora
  // quando o localStorage mudar.
  useEffect(() => {
    const handler = () => {
      printerConfigRef.current =
        loadPrinterConfig()
    }

    window.addEventListener(
      'storage',
      handler,
    )

    return () => {
      window.removeEventListener(
        'storage',
        handler,
      )
    }
  }, [])

  // Encerra o toque ao sair da tela.
  useEffect(() => {
    return () => {
      stopRinger()
    }
  }, [])

  const handleStopRinging =
    useCallback(() => {
      stopRinger()
      setIsRinging(false)
    }, [])

  const handleStartRinging =
    useCallback(() => {
      if (!soundEnabledRef.current) {
        return
      }

      startRinger()
      setIsRinging(true)
    }, [])

  const handlePrintOrder =
    useCallback(
      async (order: Order) => {
        const config =
          printerConfigRef.current

        if (
          config.connection === 'none'
        ) {
          return
        }

        try {
          await printOrder(
            {
              id: order.id,
              customer_name:
                order.customer_name,
              customer_phone:
                order.customer_phone,
              address: order.address,
              neighborhood:
                order.neighborhood,
              payment_method:
                order.payment_method,
              notes: order.notes,
              total: order.total,
              delivery_fee:
                order.delivery_fee || 0,
              created_at:
                order.created_at,
              items: (
                order.items || []
              ).map((item) => ({
                product_name:
                  item.product_name,
                quantity: item.quantity,
                unit_price:
                  item.unit_price,
              })),
            },
            config,
          )

          toast.success(
            'Pedido impresso!',
          )
        } catch (error: any) {
          toast.error(
            error.message ||
              'Erro ao imprimir',
          )
        }
      },
      [],
    )

  const fetchOrders = useCallback(
    async (notify = false) => {
      const { data, error } =
        await supabase
          .from('orders')
          .select(
            '*, items:order_items(*)',
          )
          .eq(
            'restaurant_id',
            restaurantId,
          )
          .neq('status', 'delivered')
          .order('created_at', {
            ascending: false,
          })

      if (!error && data) {
        const currentIds = new Set(
          data.map(
            (order: any) => order.id,
          ),
        )

        const newOrders = notify
          ? data.filter(
              (order: any) =>
                !prevIdsRef.current.has(
                  order.id,
                ),
            )
          : []

        if (newOrders.length > 0) {
          toast.success(
            `${
              newOrders.length === 1
                ? 'Novo pedido recebido'
                : `${newOrders.length} novos pedidos`
            }! 🎉`,
          )

          scrollRef.current?.scrollTo({
            top: 0,
            behavior: 'smooth',
          })

          handleStartRinging()

          const config =
            printerConfigRef.current

          if (
            config.connection !==
              'none' &&
            config.autoprint
          ) {
            for (const order of newOrders) {
              await handlePrintOrder(
                order as Order,
              )
            }
          }
        }

        const hasPending = data.some(
          (order: any) =>
            order.status === 'pending',
        )

        if (!hasPending) {
          stopRinger()
          setIsRinging(false)
        }

        prevIdsRef.current =
          currentIds

        setOrders(data as Order[])
        setLastUpdate(new Date())
      }

      setLoading(false)
    },
    [
      restaurantId,
      handleStartRinging,
      handlePrintOrder,
    ],
  )

  const handleEnableSound = () => {
    saveSoundPreference(
      restaurantId,
      true,
    )

    soundEnabledRef.current = true
    setSoundEnabled(true)

    testRing()

    toast.success(
      'Som ativado permanentemente! 🔔',
    )
  }

  const handleDisableSound = () => {
    saveSoundPreference(
      restaurantId,
      false,
    )

    handleStopRinging()

    soundEnabledRef.current = false
    setSoundEnabled(false)

    toast.success(
      'Som desativado',
    )
  }

  useEffect(() => {
    fetchOrders(false)
  }, [fetchOrders])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(true)
    }, 8000)

    return () => {
      clearInterval(interval)
    }
  }, [fetchOrders])

  useEffect(() => {
    const channel = supabase
      .channel(
        `orders-admin-rt-${restaurantId}`,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter:
            `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchOrders(true)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, fetchOrders])

  const updateStatus = async (
    order: Order,
    currentStatus: OrderStatus,
  ) => {
    const next =
      STATUS_NEXT[currentStatus]

    if (!next) {
      return
    }

    if (currentStatus === 'pending') {
      handleStopRinging()

      const config =
        printerConfigRef.current

      if (
        config.connection !== 'none' &&
        !config.autoprint
      ) {
        await handlePrintOrder(order)
      }
    }

    const { error } = await supabase
      .from('orders')
      .update({
        status: next,
      })
      .eq('id', order.id)

    if (error) {
      toast.error(
        'Erro ao atualizar status',
      )

      return
    }

    setOrders((previous) => {
      const updated = previous.map(
        (currentOrder) =>
          currentOrder.id === order.id
            ? {
                ...currentOrder,
                status: next,
              }
            : currentOrder,
      )

      const hasPending = updated.some(
        (currentOrder) =>
          currentOrder.status ===
          'pending',
      )

      if (!hasPending) {
        stopRinger()
        setIsRinging(false)
      }

      return updated
    })

    toast.success(
      `Status: ${STATUS_MAP[next].label}`,
    )
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3].map((item) => (
          <Skeleton
            key={item}
            className="h-48 rounded-lg"
          />
        ))}
      </div>
    )
  }

  const printerConfig =
    loadPrinterConfig()

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Atualizado às{' '}
          {lastUpdate.toLocaleTimeString(
            'pt-BR',
            {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            },
          )}
        </p>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              fetchOrders(false)
            }
            className="h-8 text-xs"
          >
            Atualizar
          </Button>

          {!soundEnabled ? (
            <Button
              size="sm"
              variant="default"
              onClick={handleEnableSound}
              className="h-8 gap-1.5 text-xs"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Ativar som
            </Button>
          ) : isRinging ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={
                handleStopRinging
              }
              className="h-8 gap-1.5 text-xs animate-pulse"
            >
              <VolumeX className="h-3.5 w-3.5" />
              Parar toque
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={
                handleDisableSound
              }
              className="h-8 gap-1.5 text-xs"
              title="Clique para desativar o som"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Som ativo
            </Button>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="mb-4 h-16 w-16 text-muted-foreground/30" />

          <h3 className="text-lg font-semibold">
            Nenhum pedido ativo
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Os novos pedidos aparecerão
            aqui em tempo real.
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {orders.map((order) => {
            const subtotal =
              order.total -
              (order.delivery_fee || 0)

            return (
              <Card
                key={order.id}
                className={cn(
                  'transition-all',
                  order.status ===
                    'pending' &&
                    'ring-2 ring-primary/30',
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {
                          order.customer_name
                        }
                      </CardTitle>

                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(
                          order.created_at,
                        )}
                      </p>
                    </div>

                    <Badge
                      variant={
                        STATUS_MAP[
                          order.status
                        ].variant
                      }
                      className="shrink-0 gap-1 text-xs"
                    >
                      {
                        STATUS_MAP[
                          order.status
                        ].icon
                      }

                      {
                        STATUS_MAP[
                          order.status
                        ].label
                      }
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {order.customer_phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />

                        {
                          order.customer_phone
                        }
                      </div>
                    )}

                    <div className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />

                      <span>
                        {order.address}

                        {order.neighborhood
                          ? ` — ${order.neighborhood}`
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3" />

                      {PAYMENT_LABEL[
                        order.payment_method
                      ] ||
                        order.payment_method}
                    </div>
                  </div>

                  {order.items &&
                    order.items.length >
                      0 && (
                      <div className="border-t border-border pt-2">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                          Itens
                        </p>

                        <ul className="space-y-1">
                          {order.items.map(
                            (item) => (
                              <li
                                key={item.id}
                                className="flex justify-between text-sm"
                              >
                                <span className="flex-1 pr-2">
                                  {
                                    item.quantity
                                  }
                                  x{' '}
                                  {
                                    item.product_name
                                  }
                                </span>

                                <span className="shrink-0 text-muted-foreground">
                                  {formatBRL(
                                    item.unit_price *
                                      item.quantity,
                                  )}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                  {order.notes && (
                    <div className="rounded-md bg-accent px-2.5 py-1.5">
                      <p className="text-xs text-accent-foreground">
                        <span className="font-medium">
                          Obs:
                        </span>{' '}
                        {order.notes}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1 border-t border-border pt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Subtotal</span>

                      <span>
                        {formatBRL(
                          subtotal,
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Entrega</span>

                      <span>
                        {(order.delivery_fee ||
                          0) > 0
                          ? formatBRL(
                              order.delivery_fee!,
                            )
                          : 'Grátis'}
                      </span>
                    </div>

                    <div className="flex justify-between font-bold">
                      <span className="text-sm">
                        Total
                      </span>

                      <span className="text-lg text-primary">
                        {formatBRL(
                          order.total,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {order.status !==
                      'delivered' && (
                      <Button
                        size="sm"
                        variant={
                          order.status ===
                          'pending'
                            ? 'default'
                            : 'secondary'
                        }
                        onClick={() =>
                          updateStatus(
                            order,
                            order.status,
                          )
                        }
                        className="flex-1"
                      >
                        {order.status ===
                          'pending' && (
                          <>
                            {printerConfig.connection !==
                              'none' &&
                              !printerConfig.autoprint && (
                                <Printer className="mr-1 h-3.5 w-3.5" />
                              )}

                            Iniciar Preparo
                          </>
                        )}

                        {order.status ===
                          'preparing' &&
                          'Sair p/ Entrega'}

                        {order.status ===
                          'out_for_delivery' &&
                          'Marcar Entregue'}
                      </Button>
                    )}

                    {printerConfig.connection !==
                      'none' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handlePrintOrder(
                            order,
                          )
                        }
                        className="shrink-0"
                        title="Imprimir pedido"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}