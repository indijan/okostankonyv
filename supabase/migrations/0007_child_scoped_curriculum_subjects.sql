alter table if exists curriculum_subjects
  add column if not exists child_id uuid references children(id) on delete cascade;

alter table if exists curriculum_subjects
  drop constraint if exists curriculum_subjects_grade_name_key;

create unique index if not exists curriculum_subjects_child_grade_name_idx
  on curriculum_subjects(child_id, grade, name);

create index if not exists curriculum_subjects_child_id_idx
  on curriculum_subjects(child_id);
