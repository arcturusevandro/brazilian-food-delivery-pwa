import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContextValue = { value: string; setValue: (value: string) => void }
const TabsContext = React.createContext<TabsContextValue | null>(null)

export function Tabs({ defaultValue, value, onValueChange, className, children }: { defaultValue?: string; value?: string; onValueChange?: (value: string) => void; className?: string; children: React.ReactNode }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '')
  const currentValue = value ?? internalValue
  const setValue = (next: string) => { if (value === undefined) setInternalValue(next); onValueChange?.(next) }
  return <TabsContext.Provider value={{ value: currentValue, setValue }}><div className={className}>{children}</div></TabsContext.Provider>
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)} {...props} />
}

export function TabsTrigger({ value, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs')
  const active = ctx.value === value
  return <button type="button" role="tab" aria-selected={active} data-state={active ? 'active' : 'inactive'} onClick={() => ctx.setValue(value)} className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm', className)} {...props}>{children}</button>
}

export function TabsContent({ value, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('TabsContent must be used within Tabs')
  if (ctx.value !== value) return null
  return <div role="tabpanel" data-state="active" className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)} {...props}>{children}</div>
}
