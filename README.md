# VisitasHUB — HUB SENAI Alagoas

**Sistema operacional de geração de visitas técnicas** do HUB SENAI Alagoas. Reúne, num só lugar, o **guia operacional** do processo comercial e a **gestão em Kanban** do funil de leads — do mapeamento inicial até o handoff para o time comercial.

O objetivo é padronizar e acelerar a captação de oportunidades: cada lead percorre etapas com checklists claros, e o time acompanha prazos, cargas e conversão por um dashboard.

---

## ✨ Funcionalidades

- **Funil Kanban** com quatro etapas — Mapeamento → Exploração → Visita Técnica → Handoff — mais um bucket **Perdido** para oportunidades sem retorno.
- **Checklists por etapa**, com barra de progresso em cada card.
- **Guia operacional** contextual por etapa e por pilar (atividades, mensagens prontas, objeções e metas).
- **Dois pilares** de atuação: 🚀 Empreendedorismo Inovador e 🔩 Prototipagem.
- **Ficha do lead** completa: decisor, contato, WhatsApp, dor, serviços de maior fit, decisor final, próximo passo, etc.
- **Gerador de briefing** para o handoff comercial, com **exportação em PDF**.
- **Dashboard** com KPIs, funil de conversão, carga por responsável, serviços/canais e motivos de perda — com **filtro de tempo** (esta semana, semana anterior, mês, período personalizado).
- **Alertas automáticos**: contato vencido, briefing atrasado e "candidato a Perdido" (sem retorno há ≥ 30 dias).
- **Login com acesso restrito** (barreira simples client-side) e **sessão lembrada** no dispositivo.
- **Persistência resiliente**: grava no Supabase (compartilhado entre dispositivos) com cache local como rede de segurança — mudanças nunca se perdem.

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| UI | React 19 |
| Build | Vite 6 + TypeScript |
| Gráficos | Recharts |
| Banco de dados | Supabase (PostgreSQL) |
| Hospedagem | Vercel |

---

## 🚀 Rodando localmente

Pré-requisitos: **Node.js 18+**.

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite o .env com suas credenciais (ver abaixo)

# 3. Ambiente de desenvolvimento
npm run dev

# Build de produção
npm run build
npm run preview
```

---

## 🔑 Variáveis de ambiente

Definidas no `.env` (local) e em **Vercel → Settings → Environment Variables** (produção). Como o Vite embute essas variáveis no momento do *build*, qualquer alteração exige um novo deploy.

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon public` do Supabase |
| `VITE_APP_PASSWORD` | Senha da tela de login (o e-mail autorizado é fixo: `hub@al.senai.br`) |

---

## 🗄️ Banco de dados (Supabase)

O esquema fica em [`supabase/schema.sql`](supabase/schema.sql). Para configurar:

1. No painel do Supabase → **SQL Editor** → **New query**.
2. Cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.

O script cria a tabela `hub_leads`, os índices, o trigger de `updated_at` e as políticas de RLS. É **idempotente** (`create ... if not exists`, `drop policy if exists`, `alter table ... add column if not exists`), então pode ser reexecutado com segurança sempre que novas colunas forem adicionadas ao projeto.

> ⚠️ Rode o SQL **no mesmo projeto** apontado por `VITE_SUPABASE_URL`. Projetos gratuitos do Supabase pausam após inatividade — se as gravações falharem com *"Failed to fetch"*, verifique se o projeto está ativo.

---

## 📦 Estrutura do projeto

```
VisitasHUB/
├── src/
│   ├── App.tsx                 # aplicação (Kanban, Dashboard, Guia, modais)
│   ├── main.tsx                # entrypoint React
│   ├── index.css               # estilos base
│   ├── components/
│   │   ├── Login.tsx           # tela de login
│   │   └── SupabaseSetup.tsx   # tela exibida quando o Supabase não está configurado
│   └── lib/
│       ├── auth.ts             # controle de acesso (barreira client-side)
│       ├── supabase.ts         # cliente Supabase
│       └── leads-db.ts         # modelo, normalização e CRUD de leads
├── supabase/
│   └── schema.sql              # esquema do banco (tabela + RLS)
├── .env.example                # modelo de variáveis de ambiente
├── vercel.json                 # configuração de deploy
└── vite.config.ts
```

---

## 🚢 Deploy

Hospedado na **Vercel**, com deploy automático a partir do GitHub:

- Push/merge na branch **`main`** → deploy de **produção**.
- Push em outras branches → **preview deployment** (URL temporária).

Lembre-se de cadastrar as variáveis de ambiente na Vercel e refazer o deploy após alterá-las.

---

## 🔒 Nota sobre segurança

A autenticação atual é uma **barreira client-side** (e-mail fixo + senha em variável de ambiente). Ela restringe o acesso casual à interface, mas **não protege os dados no banco** — para segurança real, o caminho é migrar para **Supabase Auth** com políticas de RLS baseadas em `auth.uid()`.

---

_Projeto interno do HUB SENAI Alagoas · 2026._
