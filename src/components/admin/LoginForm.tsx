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
  const [inviteCode, setInviteCode] = useState('')

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
          toast.error('Este convite é exclusivo para o e-mail autorizado.')
          return
        }
        if (password !== '123456') {
          toast.error('Use a senha temporária informada pelo responsável.')
          return
        }
        if (restaurantName.trim().toLowerCase() !== 'reidohamburguer' || !inviteCode.trim()) {
          toast.error('Confira o usuário e informe o código de convite.')
          return
        }

        const { error: activationError } = await supabase.functions.invoke('activate-restaurant-admin', {
          body: {
            email: email.trim().toLowerCase(),
            username: restaurantName.trim().toLowerCase(),
            invite_code: inviteCode.trim(),
          },
        })
        if (activationError) throw activationError

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: '123456',
        })
        if (signInError) throw signInError

        toast.success('Acesso ativado. Agora crie sua senha pessoal.')
        window.location.replace('/redefinir-senha')
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
            {isRecovering ? 'Redefinir senha' : isSignUp ? 'Criar conta' : 'Entrar'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isRecovering
              ? 'Informe o e-mail cadastrado para receber o link de redefinição.'
              : isSignUp
                ? 'Ative o acesso ao restaurante existente'
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
              <div className="space-y-2">
                <Label htmlFor="invite-code">Código de convite</Label>
                <Input
                  id="invite-code"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Carregando...'
                : isRecovering
                  ? 'Enviar link de redefinição'
                  : isSignUp
                    ? 'Ativar acesso'
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
