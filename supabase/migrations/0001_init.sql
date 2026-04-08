create extension if not exists vector;

create type source_type as enum ('nkp_pdf', 'uploaded_pdf');
create type lesson_summary_type as enum (
  'short_summary',
  'child_friendly_explanation',
  'key_points'
);
create type lesson_progress_status as enum (
  'not_started',
  'in_progress',
  'completed',
  'needs_review'
);
create type ingest_job_status as enum (
  'queued',
  'extracting',
  'structuring',
  'completed',
  'failed'
);

create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_year integer not null check (birth_year between 2000 and 2100),
  active boolean not null default true,
  parent_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  grade text not null,
  source_type source_type not null,
  source_uri text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  title text not null,
  chapter text not null,
  lesson_order integer not null,
  goal text not null default '',
  status ingest_job_status not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, lesson_order)
);

create table if not exists lesson_chunks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  page_from integer not null,
  page_to integer not null,
  raw_text text not null,
  cleaned_text text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  check (page_from <= page_to)
);

create table if not exists lesson_summaries (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  type lesson_summary_type not null,
  content text not null,
  grounding_score numeric(5,2) not null check (grounding_score between 0 and 100),
  factuality_score numeric(5,2) not null check (factuality_score between 0 and 100),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists quiz_items (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  question text not null,
  options_json jsonb not null,
  correct_answer text not null,
  explanation text not null,
  source_quote text not null,
  source_page integer not null,
  grounding_score numeric(5,2) not null check (grounding_score between 0 and 100),
  factuality_score numeric(5,2) not null check (factuality_score between 0 and 100),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists lesson_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  status lesson_progress_status not null default 'not_started',
  score numeric(5,2),
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, lesson_id),
  check (score is null or score between 0 and 100)
);

create table if not exists ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  status ingest_job_status not null default 'queued',
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text
);

create index if not exists lessons_book_id_idx on lessons(book_id);
create index if not exists lesson_chunks_lesson_id_idx on lesson_chunks(lesson_id);
create index if not exists lesson_summaries_lesson_id_idx on lesson_summaries(lesson_id);
create index if not exists quiz_items_lesson_id_idx on quiz_items(lesson_id);
create index if not exists lesson_progress_child_id_idx on lesson_progress(child_id);
create index if not exists lesson_progress_lesson_id_idx on lesson_progress(lesson_id);
create index if not exists ingest_jobs_book_id_idx on ingest_jobs(book_id);
create index if not exists lesson_chunks_embedding_idx
  on lesson_chunks using hnsw (embedding vector_cosine_ops);
