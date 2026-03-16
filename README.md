# 💪 FitForge — Sistema de Gestão para Academias

![FitForge](https://img.shields.io/badge/FitForge-Gym%20Management-A3E635?style=for-the-badge&logo=dumbbell&logoColor=black)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?style=flat-square&logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?style=flat-square&logo=supabase)

Sistema completo de gestão para academias e estúdios fitness. Controle de alunos, check-ins, treinos, avaliações físicas e financeiro — tudo em uma plataforma moderna e responsiva.

---

## 🚀 Funcionalidades

### 🏠 Landing Page
- Apresentação da academia com planos e preços
- Design dark com acentos em verde lima
- Totalmente responsiva (mobile-first)

### 📱 Área do Aluno
- Acesso via número de telefone (sem login/senha)
- Visualização de treinos ativos com exercícios detalhados
- Histórico de avaliações físicas com gráficos de evolução
- Histórico de check-ins e pagamentos
- Interface mobile-first com bottom tabs

### ✅ Check-in Digital
- Tela otimizada para tablet na recepção
- Busca por nome ou telefone
- Validação: apenas alunos ativos, máximo 1 check-in por dia
- Feed em tempo real dos check-ins do dia

### 📊 Painel Administrativo

| Aba | Descrição |
|-----|-----------|
| **Dashboard** | KPIs em tempo real, alunos ausentes, mensalidades vencendo, feed de check-ins |
| **Alunos** | Cadastro completo, avaliações físicas, histórico de treinos |
| **Treinos** | Templates de treino com exercícios, séries, repetições e vídeos |
| **Financeiro** | Controle de mensalidades, geração automática, exportação CSV |
| **Analytics** | Gráficos de frequência, receita, retenção, horários de pico |
| **Configurações** | Dados da academia, gestão de planos, horários de funcionamento |

---

## 🛡️ Segurança

- **Row Level Security (RLS)** em todas as tabelas
- **Triggers de validação server-side:**
  - Telefone único por aluno
  - Rate limiting de check-in (1x/dia)
  - Bloqueio de check-in para alunos inativos
  - Validação de datas em pagamentos
- Proteção contra login brute-force (bloqueio após 5 tentativas)
- Sanitização de inputs no frontend

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Estilização** | Tailwind CSS, shadcn/ui, Framer Motion |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **Gráficos** | Recharts |
| **Deploy** | Lovable Cloud |

---

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── admin/          # Componentes do painel administrativo
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminFinanceiro.tsx
│   │   ├── AdminAnalytics.tsx
│   │   ├── AdminConfig.tsx
│   │   ├── AdminAssessments.tsx
│   │   └── AdminTreinos.tsx
│   └── ui/             # Componentes shadcn/ui
├── pages/
│   ├── Index.tsx       # Landing page
│   ├── Admin.tsx       # Painel administrativo
│   ├── AdminLogin.tsx  # Login do admin
│   ├── Checkin.tsx     # Tela de check-in
│   ├── StudentArea.tsx # Área do aluno
│   └── NotFound.tsx
├── hooks/              # Custom hooks
├── integrations/       # Configuração Supabase
└── lib/                # Utilitários
```

---

## 🗄️ Modelo de Dados

```
students ──┬── checkins
            ├── payments ── plans
            ├── assessments
            └── student_workouts ── workout_templates ── workout_exercises

business_settings (configurações da academia)
```

---

## ⚡ Como Rodar Localmente

```bash
# 1. Clone o repositório
git clone <URL_DO_REPO>

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente (.env)
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=...

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

---

## 📄 Licença

Projeto privado — todos os direitos reservados.

---

<p align="center">
  Feito com 💚 usando <a href="https://lovable.dev">Lovable</a>
</p>
