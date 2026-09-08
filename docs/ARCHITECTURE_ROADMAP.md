# Brazilian Food Delivery PWA — Arquitetura e Roadmap Aprovados

Data de decisão: 05/09/2026

## Objetivo

Preparar a plataforma para operação comercial real do delivery, com foco inicial em confiabilidade operacional, pagamentos Pix via Mercado Pago e gestão administrativa em desktop e aplicativo Android.

## Experiências do produto

### 1. Cliente — Web/PWA

O cliente fará o pedido pelo navegador, sem obrigatoriedade de instalar aplicativo.

Principais pontos:
- cardápio online;
- categorias, produtos e adicionais;
- carrinho;
- endereço e taxa de entrega;
- formas de pagamento;
- Pix online integrado;
- confirmação do pedido;
- experiência responsiva e instalável como PWA quando desejado.

### 2. Administrativo — Painel Web para PC

O painel web continuará sendo a interface administrativa completa da operação.

Escopo principal:
- pedidos em tempo real;
- aceite e evolução do status do pedido;
- impressão;
- histórico;
- produtos e cardápio;
- adicionais;
- taxas e bairros;
- horários de funcionamento;
- relatórios;
- configurações;
- acompanhamento de pagamentos.

### 3. Administrativo — App Android

O aplicativo Android terá foco operacional, não será apenas uma cópia do painel desktop.

Escopo inicial:
- login administrativo;
- sessão persistente;
- novos pedidos em tempo real;
- push notification;
- som e vibração;
- badge de pedidos;
- fluxo operacional: Novo → Preparando → Saiu para entrega → Entregue;
- visualização do status financeiro;
- contato rápido com cliente;
- abertura do endereço no Maps;
- reconexão automática;
- indicação de conectividade;
- cache dos últimos pedidos;
- sincronização com o painel web por meio do Supabase.

A estratégia inicial é Android primeiro. iOS fica para fase posterior.

## Fonte única de verdade

O Supabase será a fonte central dos dados para cliente web, painel administrativo e app Android.

Todos os clientes devem observar e atualizar os mesmos registros, respeitando autenticação, RLS e permissões.

## Integração Pix Mercado Pago

A integração de Pix online é prioridade antes do app Android.

Fluxo aprovado:

1. Cliente monta o pedido.
2. Backend cria/valida o pedido.
3. Backend solicita cobrança Pix ao Mercado Pago.
4. Mercado Pago retorna QR Code e código Pix Copia e Cola.
5. Cliente realiza o pagamento.
6. Mercado Pago envia webhook.
7. Backend valida a notificação e atualiza o pagamento.
8. Supabase Realtime propaga a mudança.
9. Painel e app exibem o pedido como pago e pronto para operação.

### Regras obrigatórias

- Access Token do Mercado Pago somente no backend/secret.
- Nunca expor credenciais sensíveis no frontend.
- Usar idempotência na criação de pagamentos.
- Confirmar pagamento por webhook, não pelo navegador do cliente.
- Validar autenticidade da notificação.
- Tratar webhooks repetidos de forma idempotente.
- Separar status operacional do pedido e status financeiro.

## Modelo de estados

### Pedido

Estados operacionais previstos:
- awaiting_payment;
- pending;
- preparing;
- out_for_delivery;
- delivered;
- cancelled.

### Pagamento

Estados financeiros previstos:
- pending;
- approved;
- rejected;
- cancelled;
- expired;
- refunded, quando aplicável.

## Nova entidade de pagamentos

Criar tabela dedicada `payments`, em vez de usar apenas `payment_method` dentro de `orders`.

Campos previstos:
- id;
- order_id;
- provider;
- provider_order_id;
- provider_payment_id, quando aplicável;
- payment_method;
- amount;
- status;
- qr_code;
- qr_code_base64 ou representação equivalente, se necessário;
- expiration_at;
- approved_at;
- created_at;
- updated_at.

## Multiestabelecimento

O banco já utiliza `restaurant_id` em entidades centrais, o que deve ser preservado.

A evolução futura deverá permitir múltiplos estabelecimentos, com isolamento completo por tenant/restaurante.

O frontend atual não deve permanecer dependente de buscar simplesmente o primeiro restaurante disponível. Em fase posterior, o restaurante deverá ser resolvido por slug, domínio ou subdomínio.

## Ordem de execução aprovada

### Fase 1 — Operação real

Validar ponta a ponta:
- cardápio;
- carrinho;
- adicionais;
- entrega;
- pedido;
- painel;
- impressão;
- produção;
- entrega.

### Fase 2 — Pix Mercado Pago

Implementar:
- modelo de pagamentos;
- Edge Functions/backend;
- criação de cobrança Pix;
- QR Code;
- Copia e Cola;
- webhook;
- idempotência;
- atualização em tempo real;
- interface de pagamento.

### Fase 3 — Segurança

Revisar:
- RLS;
- autenticação;
- secrets;
- validação de webhook;
- manipulação de preço;
- autorização por restaurante;
- logs e auditoria.

### Fase 4 — Confiabilidade

Testar cenários:
- internet instável;
- reconexão;
- duplo clique;
- pedido duplicado;
- pagamento duplicado;
- webhook duplicado;
- webhook fora de ordem;
- falha de impressão;
- sessão expirada;
- Realtime desconectado.

### Fase 5 — Teste real

Executar pedidos completos em ambiente de teste até validar a operação ponta a ponta.

### Fase 6 — Go-live

Liberar a plataforma para receber pedidos reais no delivery.

### Fase 7 — App Android administrativo

Após estabilizar estados de pedido e pagamento:
- criar aplicativo administrativo com Capacitor ou abordagem equivalente que maximize reaproveitamento do código;
- integrar push nativo;
- testar operação em segundo plano;
- validar reconexão e notificações;
- distribuir APK para operação interna inicialmente;
- preparar publicação oficial posteriormente.

### Fase 8 — Evoluções comerciais

Após estabilização:
- CRM;
- cupons;
- fidelidade;
- recuperação de carrinho;
- WhatsApp;
- marketing;
- inteligência artificial;
- multiestabelecimento;
- iOS;
- recursos adicionais de cozinha e logística.

## Princípio de implementação

Não adicionar dezenas de funcionalidades antes da abertura. A prioridade é ter uma operação pequena, previsível, segura e confiável, usando o próprio delivery como primeiro ambiente real de validação do produto.

Cada mudança relevante deverá ser registrada no GitHub para manter histórico técnico e evolução do projeto.
