# Especificação de UI — Operador de Homelab (Agendador de Mensagens)

Este projeto implementa a interface desktop de operação local de agendamento de recados / rotinas de mensagens para homelab.

## Telas mapeadas:
1. `scr-contacts` (`/contacts`): Caderno de contatos (nome + telefone) com listagem e criação rápida.
2. `scr-contact` (`/contacts/{contactId}`): Ficha completa do contato com edição, histórico de recados onde o telefone é destino ou criador, detalhes do recado e criação vinculada.
3. `scr-templates` (`/templates`): Catálogo e editor de modelos de texto reutilizáveis com placeholders de tempo e nome.
4. `scr-jobs` (`/jobs`): Painel global de agendas com filtros de status e período, lista detalhada, visualização de recado e agendamento avulso.

## Parâmetros Globais:
- Autenticação via header `x-api-key: SCHEDULE_API_KEY`.
- Locale fixo: `pt-BR`.
- Suporte a tema: `light`, `system`, `dark` (com atributo `data-theme="system"`).
- IDs estruturais de DOM rigorosamente conformes à seção 9 das diretrizes.