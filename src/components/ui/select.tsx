import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type SelectContextValue = { value: string; onValueChange: (value: string) => void; open: boolean; setOpen: (open: boolean) => void; labels: Map<string, React.ReactNode>; register: (value: string, label: React.ReactNode) => void }
const SelectContext = React.createContext<SelectContextValue | null>(null)

export function Select({ value = '', onValueChange = () => {}, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const labelsRef = React.useRef(new Map<string, React.ReactNode>())
  const register = React.useCallback((itemValue: string, label: React.ReactNode) => { labelsRef.current.set(itemValue, label) }, [])
  return <SelectContext.Provider value={{ value, onValueChange, open, setOpen, labels: labelsRef.current, register }}><div className="relative">{children}</div></SelectContext.Provider>
}

export function SelectTrigger({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error('SelectTrigger must be used within Select')
  return <button type="button" aria-haspopup="listbox" aria-expanded={ctx.open} onClick={() => ctx.setOpen(!ctx.open)} className={cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}>{children}<ChevronDown className="h-4 w-4 opacity-50" /></button>
}

export function SelectValue({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error('SelectValue must be used within Select')
  return <span className="truncate">{children ?? ctx.labels.get(ctx.value) ?? placeholder ?? ctx.value}</span>
}

export function SelectContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error('SelectContent must be used within Select')
  if (!ctx.open) return <div className="hidden">{children}</div>
  return <div role="listbox" className={cn('absolute z-50 mt-1 max-h-60 w-full min-w-[8rem] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md', className)} {...props}>{children}</div>
}

export function SelectItem({ value, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error('SelectItem must be used within Select')
  React.useEffect(() => { ctx.register(value, children) }, [ctx, value, children])
  return <button type="button" role="option" aria-selected={ctx.value === value} onClick={() => { ctx.onValueChange(value); ctx.setOpen(false) }} className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50', className)} {...props}>{children}</button>
}
