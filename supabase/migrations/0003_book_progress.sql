create table if not exists book_progress (
  id uuid primary key default gen_random_uuid(),
  child_name text not null,
  book_id uuid not null references books(id) on delete cascade,
  status lesson_progress_status not null default 'not_started',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_name, book_id)
);

create index if not exists book_progress_book_id_idx on book_progress(book_id);
create index if not exists book_progress_child_name_idx on book_progress(child_name);
