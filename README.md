# Latin Quest

A gamified Latin learning platform built around the **de Romanis** (Bloomsbury) Book 1 curriculum.

* **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind, Supabase (Postgres + Auth + RLS).
* **Content:** All 6 chapters of *dei et deae* — vocab, grammar topics, principal parts, and 30+ sample exercises across 10 game types.
* **Users:** Teachers create classes (6-character join codes); students join and play self-marking exercises. Teachers get a per-student × per-chapter × per-skill mastery matrix.

## Game types

| Code | UI |
| --- | --- |
| `vocab_match` | Multiple-choice Latin → English |
| `fill_gap` | Choose the missing word to complete a sentence |
| `word_type_sort` | Drop each word into noun / verb / adjective / adverb |
| `tense_id` | Identify the tense of a verb form |
| `case_id` | Identify the case of a noun form |
| `adjective_agree` | Pick the form that agrees with the noun |
| `adverb_use` | Choose the adverb that fits the sentence |
| `preposition_picture` | Match a preposition to an inline-SVG picture |
| `translation` | Free-text translation with fuzzy marking |
| `multiple_choice` | Grammar / comprehension MCQ |

The single `ExerciseRunner` component renders the right UI for each game type based on `exercise.game_type` and the question's `options` / `metadata` JSON.

## Database

Supabase project: **`hboguukdstktlwgnsypc`** (region `eu-west-2`).

Core tables (full schema in `/supabase/migrations` if you eject; right now they live in the Supabase project history):

```
profiles          → role-aware mirror of auth.users
classes           → teacher_id + unique 6-char join_code
class_members     → many-to-many (student ⨯ class)
chapters          → 6 De Romanis chapters with grammar_summary
vocab_items       → latin/english/PoS/stem/declension/gender/principal parts
grammar_topics    → grammar threads each chapter covers
skills            → 10 game-type skill rows
exercises         → one game-type instance per chapter
exercise_questions → prompt / correct_answer / options (jsonb) / metadata (jsonb)
attempts          → finalised attempts with score_pct
attempt_answers   → per-question student_answer + is_correct
skill_progress    → aggregated mastery 0..5 per (student, chapter, skill)
```

RLS is enforced everywhere: students only see their own attempts; teachers only see students in their own classes.

## Local development

```bash
cp .env.local.example .env.local       # already has the right Supabase URL + anon key
npm install
npm run dev
```

## Deploying to Vercel via Git

1. Create an empty repo on GitHub (e.g. `latin-quest`). **Do not** add a README or .gitignore — this repo already has both.

2. From this directory, point the repo at GitHub and push:
   ```bash
   git remote add origin git@github.com:<your-username>/latin-quest.git
   git push -u origin main
   ```

3. In Vercel: **Add New → Project → Import Git Repository**, pick `latin-quest`. Vercel auto-detects Next.js — no overrides needed.

4. Add the two environment variables (under "Environment Variables" on the import page):
   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://hboguukdstktlwgnsypc.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = sb_publishable_lqnfq1a7uDCflZIg7PjbVA_jta7MKGN
   ```

5. Click **Deploy**. After ~2 minutes you'll get a `latin-quest-<hash>.vercel.app` URL.

6. **One Supabase setting to flip after the first deploy:**
   - Open the Supabase dashboard → Authentication → URL Configuration.
   - Add your Vercel domain (e.g. `https://latin-quest-<hash>.vercel.app/**`) to **Redirect URLs**.
   - Set **Site URL** to the same Vercel domain.
   - (Optional for testing: turn off "Confirm email" so signups are instant.)

## First-run checklist

Once deployed:

1. `/signup` → create a **teacher** account.
2. Teacher dashboard → create a class → copy the 6-character join code.
3. In a separate browser / incognito, `/signup` again as a **student**.
4. Student → `/learn/join` → paste the code.
5. Student → open Chapter 1 → play a couple of exercises.
6. Switch back to the teacher session and reload the class — the skill matrix lights up.

## Adding more content

Right now Chapter 1 has 9 exercises and Chapters 2–6 have 3–4 each. To add more:

1. Open the Supabase SQL editor.
2. `select id from chapters where number = N;`
3. Insert a row into `exercises`, then rows into `exercise_questions`. The `options` and `metadata` columns are JSONB; see the existing seed for the shape each `game_type` expects.

The single biggest leverage point is `preposition_picture` — its `metadata.svg` lets you inline arbitrary SVG illustrations without touching the front-end.

## Things I'd add next

- Email magic-link or OAuth (current build is email/password).
- Drag-and-drop for `word_type_sort` (currently uses select dropdowns).
- Speech-synthesis "say the word" for vocab match.
- An import endpoint for bulk vocab CSV (so adding Book 2 is one file, not 30 inserts).
- Streaks / XP / leaderboards.
