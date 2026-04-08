do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'nkp_lesson_page'
      and enumtypid = 'source_type'::regtype
  ) then
    alter type source_type add value 'nkp_lesson_page';
  end if;
end $$;
