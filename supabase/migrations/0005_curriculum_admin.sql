create table if not exists curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  grade integer not null check (grade between 1 and 12),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade, name)
);

create table if not exists curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references curriculum_subjects(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, title)
);

create table if not exists curriculum_subblocks (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references curriculum_topics(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, title)
);

create table if not exists curriculum_source_links (
  id uuid primary key default gen_random_uuid(),
  label text,
  source_type source_type not null,
  url text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists curriculum_subblock_links (
  id uuid primary key default gen_random_uuid(),
  subblock_id uuid not null references curriculum_subblocks(id) on delete cascade,
  source_link_id uuid not null references curriculum_source_links(id) on delete cascade,
  sort_order integer not null default 0,
  content_hint text,
  include_pattern text,
  exclude_pattern text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subblock_id, source_link_id)
);

alter table if exists children
  add column if not exists grade integer check (grade between 1 and 12);

create index if not exists curriculum_topics_subject_id_idx
  on curriculum_topics(subject_id);

create index if not exists curriculum_subblocks_topic_id_idx
  on curriculum_subblocks(topic_id);

create index if not exists curriculum_subblock_links_subblock_id_idx
  on curriculum_subblock_links(subblock_id);

create index if not exists curriculum_subblock_links_source_link_id_idx
  on curriculum_subblock_links(source_link_id);
