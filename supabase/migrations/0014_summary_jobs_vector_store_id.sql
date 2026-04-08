alter table if exists summary_jobs
  add column if not exists vector_store_id text;
