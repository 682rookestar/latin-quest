-- Chapter completion badges
-- A badge is awarded when a student's average mastery across all tracked
-- skills in a chapter reaches >= 4 (out of 5).
-- The unique constraint prevents duplicate awards.

create table if not exists public.chapter_badges (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references auth.users(id) on delete cascade,
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  awarded_at  timestamptz not null default now(),
  unique (student_id, chapter_id)
);

alter table public.chapter_badges enable row level security;

-- Students can read their own badges
create policy "students_read_own_badges"
  on public.chapter_badges for select
  using (auth.uid() = student_id);

-- Students can insert their own badges (checked client-side before insert)
create policy "students_insert_own_badges"
  on public.chapter_badges for insert
  with check (auth.uid() = student_id);

-- Teachers and admins can read all badges (for class reporting)
create policy "teachers_read_all_badges"
  on public.chapter_badges for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('teacher', 'admin')
    )
  );

-- Index for fast per-student lookups on the learn page
create index if not exists chapter_badges_student_idx
  on public.chapter_badges (student_id);
