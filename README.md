# Brazilian Food Delivery PWA

Plataforma web autoral para digitalizar e automatizar operações de delivery, conectando cardápio, checkout, processamento de pedidos, painel administrativo, entrega e notificações em uma única aplicação.

## Status

**Produção auditada e operacional — setembro de 2026.**

O projeto passou por migração de dependências externas, hardening do Supabase, reconciliação de migrations, revisão da PWA/service worker e validação de CI. O checkout utiliza cálculo server-side por RPC e os pedidos são protegidos por RLS.

## Tecnologias

- React + TypeScript;
- Vite / TanStack Router e Query;
- Supabase + PostgreSQL;
- Firebase Cloud Messaging;
- Tailwind CSS;
- Bun;
- GitHub Actions;
- Vercel.

## Fluxo principal

Cliente → carrinho → autenticação anônima Supabase → RPC `create_order` → `orders` / `order_items` → painel administrativo → atualização de status → entrega.

A RPC recalcula preços, adicionais, taxa de entrega e total no PostgreSQL; o valor enviado pelo navegador não é tratado como fonte autoritativa.

## Segurança e backend

- RLS ativo nas tabelas expostas auditadas;
- criação direta de `orders`/`order_items` pelo cliente bloqueada;
- checkout via RPC segura;
- permissões administrativas vinculadas ao proprietário do restaurante;
- migrations de produção versionadas em `supabase/migrations/`;
- snapshots antigos isolados em `supabase/audit/`;
- segredos não devem ser versionados.

Veja `supabase/README.md` para recuperação e regras de versionamento do backend.

## Qualidade e entrega

O CI usa instalação congelada pelo `bun.lock` e valida TypeScript, ESLint, CSS, sintaxe do service worker e build. A PWA utiliza um único service worker para cache/offline e Firebase Messaging.

## Recovery point auditado

Estado funcional/hardening consolidado na `main` em setembro de 2026. Para recuperação, preserve o histórico Git e aplique somente migrations ativas e reconciliadas; não use snapshots em `supabase/audit/` como migrations.

## Governança pendente

A proteção administrativa da branch `main` deve exigir PR e CI verde quando habilitada nas configurações do GitHub. Essa configuração é externa ao código do repositório.

---

Desenvolvido por **Evandro Bueno** como projeto autoral de tecnologia, processos e automação.
