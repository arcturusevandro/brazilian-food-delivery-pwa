import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type DialogContextValue = { open: boolean; onOpenChange: (open: boolean) => void }
const DialogContext = React.createContext<DialogContextValue | null>(null)

export function Dialog({ open = false, onOpenChange = () => {}, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onOpenChange(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error('DialogContent must be used within Dialog')
  if (!ctx.open) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation"><button type="button" aria-label="Fechar diálogo" className="absolute inset-0 bg-black/80" onClick={() => ctx.onOpenChange(false)} /><div role="dialog" aria-modal="true" className={cn('relative z-10 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg', className)} {...props}>{children}<button type="button" aria-label="Fechar" onClick={() => ctx.onOpenChange(false)} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"><X className="h-4 w-4" /></button></div></div>
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} /> }
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} /> }
export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} /> }
export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p className={cn('text-sm text-muted-foreground', className)} {...props} /> }
