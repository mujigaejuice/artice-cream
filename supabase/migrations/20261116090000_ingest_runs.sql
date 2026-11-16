-- Pipeline observability: one row per ingest cron run (collect, documents-only check, per-category process).
-- Written best-effort by lib/news/ingest-runs.ts with the service role; read by scripts/report-ingest-runs.ts.
-- Metadata only: counts, stop reason, LLM call counts and sanitized failure metadata.
-- Never prompts, article bodies, model output, gateway response bodies or secrets.
-- Retention: 30 days, deleted by /api/cron/cleanup (lib/data-retention.ts).
begin;

create table public.ingest_runs (
  run_id uuid primary key,
  route text not null check (route in ('collect','collect-documents','process')),
  category text check (category is null or char_length(category) <= 40),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  status text not null check (status in ('ok','partial','failed')),
  http_status smallint,
  collected integer,
  classified integer,
  extracted integer,
  processed integer,
  failed integer,
  stopped_by text check (stopped_by is null or char_length(stopped_by) <= 40),
  llm_calls integer,
  http_retries integer,
  error text check (error is null or char_length(error) <= 1000),
  details jsonb not null default '{}'::jsonb check (octet_length(details::text) <= 65536),
  created_at timestamptz not null default now(),
  check (finished_at >= started_at)
);

create index ingest_runs_started_at_idx on public.ingest_runs (started_at desc);
create index ingest_runs_route_category_started_idx on public.ingest_runs (route, category, started_at desc);

-- Service role only. RLS on with no policies; explicit revoke for API roles.
alter table public.ingest_runs enable row level security;
revoke all on public.ingest_runs from public, anon, authenticated;

commit;
