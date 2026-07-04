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
  const [restaurantName, setRestaurantName] = useState('')
  const { createRestaurant } = useRestaurant()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        if (!restaurantName.trim()) {
          toast.error('Digite o nome do seu restaurante')
          setLoading(false)
          return
        }
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          await createRestaurant(data.user, restaurantName.trim())
          toast.success('Conta criada! Bem-vindo ao Sabor Express.')
          onSuccess()
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
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
            SE
          </div>
          <CardTitle className="text-xl">{isSignUp ? 'Criar Conta' : 'Entrar'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Cadastre seu restaurante no Sabor Express' : 'Acesse o painel do seu restaurante'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="restaurant">Nome do Restaurante</Label>
                <Input id="restaurant" placeholder="Ex: Sabor Express" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} required />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Carregando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            <button type="button" className="text-primary font-medium hover:underline" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? 'Entrar' : 'Criar uma'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
