create table if not exists child_curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  subject_id uuid not null references curriculum_subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (child_id, subject_id)
);

create index if not exists child_curriculum_subjects_child_id_idx
  on child_curriculum_subjects(child_id);

create index if not exists child_curriculum_subjects_subject_id_idx
  on child_curriculum_subjects(subject_id);
