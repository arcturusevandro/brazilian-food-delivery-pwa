import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Label } from '@blinkdotnew/ui'
import { supabase } from '@/lib/supabase'
import toast, { Toaster as HotToaster } from 'react-hot-toast'

export const Route = createFileRoute('/redefinir-senha')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [validRecoverySession, setValidRecoverySession] = useState(false)

  useEffect(() => {
    document.title = 'Redefinir senha · Painel Administrativo'

    let active = true

    const validateSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (active) {
        setValidRecoverySession(Boolean(data.session))
        setCheckingSession(false)
      }
    }

    validateSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setValidRecoverySession(true)
        setCheckingSession(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (password.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast.success('Senha redefinida com sucesso!')
      await supabase.auth.signOut()

      window.setTimeout(() => {
        window.location.replace('/admin')
      }, 1200)
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível redefinir a senha.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-orange-50 to-background px-4">
        <p className="text-sm text-muted-foreground">Validando link de recuperação...</p>
      </div>
    )
  }

  if (!validRecoverySession) {
    return (
      <>
        <HotToaster position="top-right" toastOptions={{ duration: 3000 }} />
        <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-orange-50 to-background px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Link inválido ou expirado</CardTitle>
              <p className="text-sm text-muted-foreground">
                Solicite um novo link de redefinição na tela de login.
              </p>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => window.location.replace('/admin')}>
                Voltar para o login
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <HotToaster position="top-right" toastOptions={{ duration: 3000 }} />
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-orange-50 to-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
              RH
            </div>
            <CardTitle className="text-xl">Criar nova senha</CardTitle>
            <p className="text-sm text-muted-foreground">
              Digite e confirme a nova senha de acesso ao painel.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Mínimo de 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Digite novamente"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
