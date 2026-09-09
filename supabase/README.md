# Supabase — Versionamento e Recuperação

Este diretório documenta o estado versionado do backend do Brazilian Food Delivery PWA.

## Fonte autoritativa

O histórico ativo está em `supabase/migrations/` e deve acompanhar exatamente o histórico registrado no projeto Supabase de produção `tnmxsmllorijtomwqxmp`.

Migrations de hardening reconciliadas em 2026-09-08:

- `20260907233448_add_secure_order_rpc_and_lock_push_trigger.sql`;
- `20260907233640_harden_public_configuration_tables.sql`;
- `20260908000959_lock_down_orders_and_order_items.sql`;
- `20260908003609_restrict_owns_restaurant_rpc.sql`.
- `20260908203357_restore_authenticated_owns_restaurant_execute.sql`.

O antigo `setup.sql` foi arquivado em `audit/legacy/setup.sql`. Ele é apenas um snapshot histórico e **não deve ser usado para reconstruir o banco atual**.

## Checkout e segurança

O checkout atual usa a RPC `public.create_order`. O cliente autentica anonimamente no Supabase Auth e envia identificadores/quantidades; a função valida o restaurante e os produtos e recalcula preços, adicionais, entrega e total no PostgreSQL. O navegador não é a fonte autoritativa dos valores do pedido.

`orders` e `order_items` possuem RLS ativo. Inserts diretos pelo cliente foram removidos; a criação ocorre pela RPC. Leitura/atualização administrativa permanece limitada pelas políticas de propriedade do restaurante.

A função auxiliar `public.owns_restaurant(uuid)` é usada pelas políticas RLS e, por isso, precisa de `EXECUTE` para o papel `authenticated`. O acesso permanece revogado para `anon` e `public`; a própria função compara `auth.uid()` com o proprietário do restaurante.

A função `create_order` permanece intencionalmente `SECURITY DEFINER` e executável pelo papel `authenticated`, pois usuários de checkout usam autenticação anônima do Supabase. Qualquer mudança nesse desenho exige novo teste de checkout antes de produção.

## Notificações push

As funções implantadas estão versionadas em `functions/register-push-token` e
`functions/send-order-push`. O `config.toml` mantém `verify_jwt = false` porque
cada função possui autenticação própria: sessão Supabase validada no cadastro do
aparelho e segredo interno do webhook no envio.

Segredos necessários no ambiente das Edge Functions (nunca no Git):

- `ORDER_PUSH_WEBHOOK_SECRET`;
- `FIREBASE_PROJECT_ID`;
- `FIREBASE_CLIENT_EMAIL`;
- `FIREBASE_PRIVATE_KEY`.

O mesmo valor de `ORDER_PUSH_WEBHOOK_SECRET` deve existir no Supabase Vault para
que o trigger `notify_new_order_push()` possa chamar `send-order-push`.

## Snapshots históricos

Os arquivos em `audit/2026-09-02/` são evidências da auditoria anterior (`baseline_schema.sql` e `hardening_candidate.sql`). Eles não são migrations ativas e não devem ser reaplicados automaticamente.

## Recuperação / reconstrução

1. Use `supabase/migrations/` como histórico de mudanças versionadas.
2. Compare a lista local com o histórico de migrations do projeto Supabase antes de qualquer aplicação manual.
3. Nunca reaplique snapshots de `audit/` em produção.
4. Valide novas migrations em ambiente descartável/preview quando o plano permitir; caso contrário, use mudanças pequenas, reversíveis e verificações entre etapas.
5. Depois de DDL, rode os Security Advisors e registre warnings intencionais.
6. Valide checkout, painel, status de pedidos e push após mudanças de autenticação/RLS/RPC.
7. Nunca versione service-role keys, senhas, webhook secrets ou outros segredos.

## Estado auditado

Em 2026-09-08, checkout via RPC, RLS de pedidos, grants, PWA/service worker, CI e histórico de migrations foram auditados. O Security Advisor não apresenta os erros críticos de RLS encontrados no início da auditoria. Warnings restantes devem ser avaliados conforme o desenho de autenticação anônima e as funções intencionalmente expostas.
