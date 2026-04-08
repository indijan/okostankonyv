create table if not exists summary_jobs (
  id uuid primary key default gen_random_uuid(),
  child_name text,
  subject text,
  topic_title text,
  source_group_label text,
  lesson_id uuid references lessons(id) on delete cascade,
  status ingest_job_status not null default 'queued',
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  result_count integer not null default 0,
  error_message text
);

create index if not exists summary_jobs_requested_at_idx on summary_jobs(requested_at);
create index if not exists summary_jobs_status_idx on summary_jobs(status);
create index if not exists summary_jobs_topic_idx on summary_jobs(subject, topic_title, source_group_label);
