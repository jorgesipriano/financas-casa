# Finanças Pessoais — Multiusuário (local, com SQLite no navegador)

Este projeto roda 100% no navegador, usando sql.js (SQLite via WebAssembly) com persistência em IndexedDB. Você pode separar dados por “Espaço de trabalho” (ex: seu e-mail). Assim, vários usuários podem usar na mesma máquina/instância sem misturar registros.

Funcionalidades:
- Receitas e Despesas com classes: Fixas, Variáveis, Esporádicas
- Filtros por mês/ano/tipo/classe
- KPIs de Saldo, Receitas e Despesas do mês
- Importação rápida via texto (formato WhatsApp) e CSV
- Ideias de investimentos + calculadora de juros compostos
- Persistência local por workspace

Como usar:
1) Abrir index.html em um servidor estático (ex: npx serve .).
2) Digitar um “Espaço de trabalho” e clicar Entrar.
3) Lançar transações, filtrar e importar.

Importação:
- WhatsApp-like: linhas no formato:
  + 3500 salario fixa
  - 120 mercado variavel
- CSV: tipo,descricao,valor,data(YYYY-MM-DD),classe

Integração com WhatsApp (opcional):
- Incluímos um Worker (Cloudflare) de exemplo em worker-whatsapp.js.
- Ele recebe POST com o texto e responde JSON normalizado.
- Ajuste o parsing conforme seu provedor (Twilio/Meta).
- Fluxo recomendado:
  1. Configure Webhook do WhatsApp -> Worker (POST).
  2. No Worker, opcionalmente persista (D1, KV, etc.) ou apenas retorne JSON.
  3. No app, crie um fetch para inserir os items retornados (bulk).

Notas:
- Este app não implementa autenticação remota. “Multiusuário” aqui é baseado em espaços de trabalho locais.
- Para multiusuário real na nuvem, conecte um backend (Supabase/Cloudflare D1/Neon) e adapte db.js para enviar SQL/REST a esse backend.

