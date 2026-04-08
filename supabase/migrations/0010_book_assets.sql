create table if not exists book_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  asset_type text not null default 'image' check (asset_type in ('image')),
  url text not null,
  label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists book_assets_book_id_idx
  on book_assets(book_id);

create index if not exists book_assets_sort_order_idx
  on book_assets(book_id, sort_order);
