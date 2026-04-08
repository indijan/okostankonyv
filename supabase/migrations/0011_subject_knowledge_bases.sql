create table if not exists subject_knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  subject_id uuid not null references curriculum_subjects(id) on delete cascade,
  status text not null default 'empty' check (status in ('empty', 'processing', 'ready', 'failed')),
  provider text not null default 'openai_vector_store' check (provider in ('openai_vector_store')),
  vector_store_id text,
  last_built_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, subject_id)
);

create table if not exists subject_knowledge_files (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null references subject_knowledge_bases(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint,
  openai_file_id text,
  processing_status text not null default 'uploaded' check (processing_status in ('uploaded', 'processing', 'ready', 'failed')),
  page_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subject_knowledge_bases_child_id_idx
  on subject_knowledge_bases(child_id);

create index if not exists subject_knowledge_bases_subject_id_idx
  on subject_knowledge_bases(subject_id);

create index if not exists subject_knowledge_files_knowledge_base_id_idx
  on subject_knowledge_files(knowledge_base_id);
