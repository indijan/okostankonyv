create table if not exists subject_knowledge_segments (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid not null references subject_knowledge_bases(id) on delete cascade,
  file_id uuid not null references subject_knowledge_files(id) on delete cascade,
  page_number integer not null,
  segment_type text not null default 'content' check (segment_type in ('content', 'exercise', 'noise', 'source_note')),
  raw_text text not null,
  cleaned_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists subject_knowledge_segments_knowledge_base_id_idx
  on subject_knowledge_segments(knowledge_base_id);

create index if not exists subject_knowledge_segments_file_id_idx
  on subject_knowledge_segments(file_id);

create index if not exists subject_knowledge_segments_page_number_idx
  on subject_knowledge_segments(file_id, page_number);
