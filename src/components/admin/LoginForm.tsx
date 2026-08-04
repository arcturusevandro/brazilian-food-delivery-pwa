import { useState } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Label } from '@blinkdotnew/ui'
import { supabase } from '@/lib/supabase'
import { useRestaurant } from '@/hooks/useRestaurant'
import toast from 'react-hot-toast'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const { createRestaurant } = useRestaurant()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isRecovering) {
        const normalizedEmail = email.trim().toLowerCase()
        if (!normalizedEmail) {
          toast.error('Digite o e-mail cadastrado')
          return
        }

        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        })

        if (error) throw error

        toast.success('Link de redefinição enviado. Verifique seu e-mail.')
        setIsRecovering(false)
        return
      }

      if (isSignUp) {
        if (!restaurantName.trim()) {
          toast.error('Digite o nome do seu restaurante')
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error) throw error

        if (data.user) {
          await createRestaurant(data.user, restaurantName.trim())
          toast.success('Conta criada com sucesso!')
          onSuccess()
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error) throw error
        toast.success('Login realizado com sucesso!')
        onSuccess()
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-orange-50 to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
            RH
          </div>
          <CardTitle className="text-xl">
            {isRecovering ? 'Redefinir senha' : isSignUp ? 'Criar conta' : 'Entrar'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isRecovering
              ? 'Informe o e-mail cadastrado para receber o link de redefinição.'
              : isSignUp
                ? 'Cadastre seu restaurante'
                : 'Acesse o painel do seu restaurante'}
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {!isRecovering && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
              </div>
            )}

            {isSignUp && !isRecovering && (
              <div className="space-y-2">
                <Label htmlFor="restaurant">Nome do restaurante</Label>
                <Input
                  id="restaurant"
                  placeholder="Ex.: Rei do Hambúrguer"
                  value={restaurantName}
                  onChange={e => setRestaurantName(e.target.value)}
                  required
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Carregando...'
                : isRecovering
                  ? 'Enviar link de redefinição'
                  : isSignUp
                    ? 'Criar conta'
                    : 'Entrar'}
            </Button>
          </form>

          {!isSignUp && !isRecovering && (
            <button
              type="button"
              className="mt-4 w-full text-center text-sm font-medium text-primary hover:underline"
              onClick={() => {
                setIsSignUp(false)
                setIsRecovering(true)
                setPassword('')
              }}
            >
              Esqueci minha senha
            </button>
          )}

          {isRecovering && (
            <>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Não lembra qual e-mail foi cadastrado? Entre em contato com o responsável pelo sistema.
              </p>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  setIsRecovering(false)
                  setIsSignUp(false)
                  setPassword('')
                }}
              >
                Voltar para o login
              </button>
            </>
          )}

          {!isRecovering && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {isSignUp ? 'Já tem conta?' : 'Não tem conta?'}{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Entrar' : 'Criar uma'}
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
