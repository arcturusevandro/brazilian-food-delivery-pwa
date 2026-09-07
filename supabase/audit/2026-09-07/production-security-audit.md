# Auditoria Supabase de Produção — 07/09/2026

Projeto auditado: `food delivery` (`tnmxsmllorijtomwqxmp`)
PostgreSQL: 17.6.1
Modo desta auditoria: somente leitura. Nenhum SQL de alteração foi aplicado.

## Conclusão executiva

O schema real atual corresponde de forma próxima ao snapshot preservado de 02/09/2026: 12 tabelas principais em `public`, incluindo `restaurants`, `categories`, `products`, `product_addons`, `combos`, `combo_items`, `business_hours`, `delivery_settings`, `delivery_zones`, `orders`, `order_items` e `push_subscriptions`.

O risco principal encontrado é de segurança de acesso, não de corrupção de schema.

## Achados críticos

### 1. RLS desligado em tabelas expostas

RLS está desligado em:
- `business_hours`
- `combo_items`
- `delivery_settings`
- `delivery_zones`
- `order_items`
- `orders`
- `product_addons`

O Supabase Security Advisor classificou `orders`, `order_items`, `combo_items`, `delivery_settings`, `delivery_zones`, `product_addons` e `business_hours` como `rls_disabled_in_public` (ERROR).

### 2. Grants excessivos

Os papéis `anon` e `authenticated` possuem privilégios amplos de tabela em todas as 12 tabelas públicas, incluindo SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER.

Onde RLS está desligado, esses grants representam exposição desnecessária e precisam ser reduzidos explicitamente.

### 3. Políticas existentes mas inativas

`orders` e `order_items` possuem políticas RLS cadastradas, porém RLS está desligado. O Advisor reporta `policy_exists_rls_disabled` para ambas.

### 4. Políticas duplicadas

Há políticas públicas de leitura duplicadas em `restaurants`, `categories` e `products`, além de múltiplas permissive policies detectadas pelo Performance Advisor.

### 5. Função SECURITY DEFINER exposta

A única função pública atual é `public.notify_new_order_push()`, marcada como `SECURITY DEFINER`.

O Security Advisor alerta que ela é executável por `anon` e `authenticated` via RPC. Como sua finalidade é exclusivamente ser chamada pelo trigger `new-order-push`, o EXECUTE público deve ser revogado ou a função deve ser movida para um schema não exposto.

### 6. Checkout ainda não é server-authoritative

Não existe hoje RPC `create_order` no banco real. O checkout atual continua baseado em INSERT direto no cliente para `orders` e `order_items`.

O hardening histórico de 02/09 propunha `create_order`, mas sua implementação exige `auth.uid()`. O storefront atual não realiza autenticação anônima, portanto essa função histórica não deve ser aplicada literalmente. O novo desenho precisa permitir checkout público e, ao mesmo tempo, recalcular no servidor:
- preços dos produtos;
- adicionais;
- disponibilidade;
- taxa de entrega;
- total final;
- status inicial.

### 7. Edge Functions

`register-push-token` está com `verify_jwt=false`, mas valida manualmente o Bearer token com `auth.getUser()` e confirma que o usuário é owner do restaurante antes de usar service role. Esse desenho é aceitável desde que essa validação seja preservada.

`send-order-push` também está com `verify_jwt=false`, porém exige `x-webhook-secret` igual ao segredo interno e só então usa service role. Essa função é destinada ao trigger do banco e possui autenticação própria compatível com esse uso.

### 8. Auth

O Security Advisor informou que Leaked Password Protection está desativado. Deve ser habilitado no Auth para reduzir risco de credenciais comprometidas.

## Performance

Foram detectadas foreign keys sem índice em:
- `combo_items.combo_id`
- `combo_items.product_id`
- `delivery_zones.restaurant_id`
- `order_items.product_id`
- `product_addons.product_id`
- `restaurants.owner_id`

As políticas atuais também chamam `auth.uid()` diretamente por linha em algumas tabelas; o Advisor recomenda `(select auth.uid())` para melhorar o plano de execução.

## Próximo plano seguro

1. Criar uma migração nova a partir do estado real atual, não reutilizar cegamente a migration histórica.
2. Habilitar RLS em todas as tabelas públicas expostas.
3. Substituir grants amplos por mínimos necessários.
4. Consolidar políticas duplicadas e separar claramente `anon` de `authenticated`.
5. Criar checkout server-authoritative compatível com storefront público.
6. Revogar EXECUTE público de `notify_new_order_push()` ou mover a função para schema privado.
7. Criar índices das FKs apontadas pelos Advisors quando fizer sentido para o padrão de uso.
8. Rodar Security e Performance Advisors novamente após a migração.
9. Testar em ambiente de preview/branch antes de produção.

Nenhuma dessas alterações foi aplicada ao banco de produção durante esta auditoria.
