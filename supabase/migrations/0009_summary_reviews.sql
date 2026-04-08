create table if not exists lesson_summary_reviews (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  summary_type text not null check (summary_type in ('short_summary', 'key_points')),
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  factuality_score integer not null default 0 check (factuality_score between 0 and 100),
  issues text[] not null default '{}',
  improvement_notes text[] not null default '{}',
  corrected_content text not null,
  created_at timestamptz not null default now()
);

create index if not exists lesson_summary_reviews_lesson_id_idx
  on lesson_summary_reviews(lesson_id);

create index if not exists lesson_summary_reviews_summary_type_idx
  on lesson_summary_reviews(summary_type);
