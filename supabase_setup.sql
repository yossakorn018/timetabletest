-- ตารางเก็บข้อมูลกลางของระบบจัดตาราง (รันใน Supabase > SQL Editor)
create table if not exists app_state (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);
alter table app_state enable row level security;
create policy "read"   on app_state for select using (true);
create policy "insert" on app_state for insert with check (true);
create policy "update" on app_state for update using (true);
