alter table if exists lesson_summaries
  add column if not exists source_mode text not null default 'legacy' check (source_mode in ('legacy', 'knowledge_base'));

alter table if exists lesson_summary_reviews
  add column if not exists source_mode text not null default 'legacy' check (source_mode in ('legacy', 'knowledge_base'));
