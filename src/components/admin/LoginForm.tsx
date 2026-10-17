import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)
  const [restaurantName, setRestaurantName] = useState('reidohamburguer')

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
        if (email.trim().toLowerCase() !== 'alessandra_reis22@hotmail.com.br') {
          toast.error('O cadastro inicial está autorizado somente para o e-mail informado.')
          return
        }
        if (password !== '123456' || restaurantName.trim().toLowerCase() !== 'reidohamburguer') {
          toast.error('Confira a senha temporária e o nome de usuário.')
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: '123456',
          options: {
            data: { username: 'reidohamburguer', must_change_password: true },
          },
        })
        if (error) throw error

        if (data.session) {
          toast.success('Conta criada. Agora defina sua senha pessoal.')
          window.location.replace('/redefinir-senha')
        } else {
          toast.success('Verifique o e-mail para confirmar a conta. Depois entre no painel.')
        }
        return
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error) throw error
        if (data.user?.user_metadata?.must_change_password) {
          window.location.replace('/redefinir-senha')
          return
        }
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
            {isRecovering ? 'Redefinir senha' : isSignUp ? 'Ativar acesso' : 'Entrar'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isRecovering
              ? 'Informe o e-mail cadastrado para receber o link de redefinição.'
              : isSignUp
                ? 'Crie a conta autorizada; o vínculo ao restaurante será feito em seguida'
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
                <Label htmlFor="password">{isSignUp ? 'Senha temporária' : 'Senha'}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={isSignUp ? '123456 (temporária)' : '••••••••'}
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
                <Label htmlFor="restaurant">Nome de usuário</Label>
                <Input
                  id="restaurant"
                  value={restaurantName}
                  onChange={e => setRestaurantName(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Carregando...'
                : isRecovering
                  ? 'Enviar link de redefinição'
                  : isSignUp
                    ? 'Criar conta autorizada'
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
              {isSignUp ? 'Já tem acesso?' : 'Recebeu um convite?'}{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Entrar' : 'Ativar acesso'}
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
