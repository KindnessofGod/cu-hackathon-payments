-- Storage for the deployed demo. Reached only from server code with the database password.
create table if not exists op_docs (
  collection text not null,
  id text not null,
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
-- Row level security on with no policies: the public API keys can read nothing.
alter table op_docs enable row level security;
