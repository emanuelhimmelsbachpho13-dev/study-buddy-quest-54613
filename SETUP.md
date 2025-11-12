# Setup do Projeto - Vercel + Supabase + Gemini

## 1. Configurar Supabase

Execute as seguintes queries SQL no SQL Editor do Supabase:

```sql
-- Create quizzes table
create table if not exists public.quizzes (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  material_title text not null,
  created_at timestamp with time zone default now() not null
);

-- Create questions table
create table if not exists public.questions (
  id bigserial primary key,
  quiz_id bigint references public.quizzes(id) on delete cascade not null,
  pergunta text not null,
  opcoes jsonb not null,
  resposta_correta text not null,
  ordem integer not null,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;

-- RLS Policies for quizzes
create policy "Users can view their own quizzes"
  on public.quizzes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quizzes"
  on public.quizzes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own quizzes"
  on public.quizzes for delete
  using (auth.uid() = user_id);

-- RLS Policies for questions
create policy "Users can view questions from their quizzes"
  on public.questions for select
  using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = questions.quiz_id
      and quizzes.user_id = auth.uid()
    )
  );

create policy "Service role can insert questions"
  on public.questions for insert
  with check (true);

-- Create indexes for performance
create index if not exists quizzes_user_id_idx on public.quizzes(user_id);
create index if not exists questions_quiz_id_idx on public.questions(quiz_id);

-- Create storage bucket for uploads
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- Storage policies
create policy "Users can upload their own files"
  on storage.objects for insert
  with check (
    bucket_id = 'uploads' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own files"
  on storage.objects for select
  using (
    bucket_id = 'uploads' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'uploads' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## 2. Configurar Variáveis de Ambiente

### Frontend (.env)
```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### Vercel (Dashboard > Settings > Environment Variables)
```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-chave-service-role-aqui
GEMINI_API_KEY=sua-chave-gemini-aqui
```

## 3. Como obter as chaves

### Supabase:
1. Vá para o seu projeto no Supabase
2. Settings > API
3. Copie a `URL` e `anon/public` key para o frontend
4. Copie a `service_role` key (⚠️ SECRETA) para o Vercel

### Gemini API:
1. Vá para https://makersuite.google.com/app/apikey
2. Crie uma nova API key
3. Adicione ao Vercel como `GEMINI_API_KEY`

## 4. Deploy na Vercel

1. Conecte seu repositório GitHub à Vercel
2. Configure as variáveis de ambiente
3. Deploy!

A função `/api/generate` estará disponível automaticamente.
