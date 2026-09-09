-- Target known question content, not environment-specific generated IDs.
-- Keep existing attempts and scores unchanged.
update public.exercise_questions
set correct_answer = 'he is away'
where prompt = '"abest" means…'
  and correct_answer = 'he/she is away'
  and options = '["he is here","he is away","he can","he goes"]'::jsonb;

update public.exercise_questions
set correct_answer = 'I am present',
    options = '["I am present","I am absent","I am able","I want"]'::jsonb
where (prompt = 'adsum literally means…' and correct_answer = 'be present'
       and options = '["be here / present","be away","be able","want"]'::jsonb)
   or (prompt = 'adsum (ad + sum) means…' and correct_answer = 'be here; be present'
       and options = '["be present; be here","be absent","be able","want"]'::jsonb);

-- This activity intentionally combines text and illustrated questions.
update public.exercises
set title = 'Preposition Practice',
    description = 'Practise preposition meanings and cases using text and illustrated questions.'
where game_type = 'preposition_picture'
  and title = 'Prepositions in pictures'
  and description = 'Pick the preposition that matches each picture.';
