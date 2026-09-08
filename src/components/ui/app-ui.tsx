import * as React from 'react'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export { Button } from '@/components/ui/button'
export { Input } from '@/components/ui/input'
export { Badge } from '@/components/ui/badge'
export { Skeleton } from '@/components/ui/skeleton'
export { Switch } from '@/components/ui/switch'
export { Textarea } from '@/components/ui/textarea'
export { Label } from '@/components/ui/label'
export { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
export { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'


type AppShellContextValue = { mobileOpen: boolean; setMobileOpen: (open: boolean) => void }
const AppShellContext = React.createContext<AppShellContextValue | null>(null)

export function AppShell({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  return (
    <AppShellContext.Provider value={{ mobileOpen, setMobileOpen }}>
      <div className={cn('min-h-dvh md:flex', className)}>{children}</div>
    </AppShellContext.Provider>
  )
}

export function AppShellSidebar({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(AppShellContext)
  const open = ctx?.mobileOpen ?? false
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => ctx?.setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 -translate-x-full bg-background transition-transform md:static md:z-auto md:translate-x-0',
          open && 'translate-x-0',
          className,
        )}
      >
        {children}
      </aside>
    </>
  )
}

export function AppShellMain({ children, className }: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn('min-w-0 flex-1', className)}>{children}</main>
}

export function MobileSidebarTrigger({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(AppShellContext)
  return (
    <button
      type="button"
      aria-label="Abrir menu"
      className={cn('inline-flex h-9 w-9 items-center justify-center rounded-md border border-border md:hidden', className)}
      onClick={() => ctx?.setMobileOpen(true)}
      {...props}
    >
      <Menu className="h-4 w-4" />
    </button>
  )
}
