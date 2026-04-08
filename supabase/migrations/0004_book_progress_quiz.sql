alter table if exists book_progress
  add column if not exists quiz_score integer,
  add column if not exists quiz_total integer,
  add column if not exists quiz_completed_at timestamptz;

