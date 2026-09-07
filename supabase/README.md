# Supabase — Versionamento e Recuperação

Este diretório documenta o estado versionado do backend do Brazilian Food Delivery PWA.

## Estado atual

`setup.sql` é um arquivo legado e **não deve ser tratado como fonte autoritativa do banco atual**. Ele representa uma versão antiga e reduzida do esquema e não contém toda a estrutura que a aplicação em produção utiliza hoje.

A aplicação atual depende, entre outros elementos, de:

- `restaurants` com `manual_override`;
- `categories`;
- `products`;
- `product_addons`;
- `combos` / estrutura relacionada;
- `business_hours`;
- `delivery_settings`;
- `delivery_zones`;
- `orders` com `delivery_fee` e `neighborhood`;
- `order_items`;
- `push_subscriptions`;
- funções/triggers relacionados a notificações e checkout.

## Snapshot auditado de 2026-09-02

Os arquivos em `audit/2026-09-02/` foram preservados a partir de uma auditoria anterior do banco real:

- `baseline_schema.sql`: snapshot do esquema observado naquela data;
- `hardening_candidate.sql`: proposta de RLS, grants mínimos, Storage e RPC `create_order` com cálculo de preços no servidor.

Esses arquivos são **referência histórica**, não migrations ativas. Não aplique nenhum deles diretamente em produção sem comparar antes com o banco atual.

## Por que não estão em `migrations/`

A aplicação e o Supabase evoluíram depois de 2026-09-02. Colocar um snapshot antigo em `migrations/` poderia fazer uma ferramenta ou desenvolvedor interpretá-lo como uma mudança pronta para execução. Mantê-lo em `audit/` preserva a evidência sem criar esse risco.

## Procedimento correto para tornar o backend reproduzível

1. Exportar/inspecionar o esquema **atual** do Supabase de produção, incluindo tabelas, colunas, constraints, índices, funções, triggers, políticas RLS, grants, Storage e Edge Functions relacionadas.
2. Comparar esse estado com `audit/2026-09-02/baseline_schema.sql` e com o frontend atual.
3. Gerar uma baseline limpa ou migrations incrementais que reproduzam exatamente o estado aprovado.
4. Validar as migrations em um projeto Supabase descartável/preview.
5. Confirmar RLS e permissões com usuários `anon` e `authenticated`.
6. Validar a RPC de checkout em preview antes de alterar o frontend para depender dela.
7. Somente depois aplicar mudanças ao ambiente de produção.
8. Registrar futuras alterações exclusivamente por migrations versionadas.

## Checkout e integridade de preços

O snapshot `hardening_candidate.sql` contém uma RPC `create_order` que recebe identificadores/quantidades e recalcula produtos, adicionais, taxa de entrega e total no PostgreSQL. Essa abordagem evita confiar em valores calculados pelo navegador.

O frontend atual ainda não deve ser alterado para depender dessa RPC até confirmarmos que a função equivalente está disponível e validada no Supabase real. Backend e frontend devem ser promovidos juntos nessa mudança.

## Regra de segurança

Nunca inclua service-role keys, senhas, webhook secrets ou outros segredos nestes arquivos. Configuração pública do cliente deve usar variáveis de ambiente; segredos de backend devem permanecer no mecanismo de secrets/Vault apropriado.
