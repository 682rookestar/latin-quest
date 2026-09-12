-- Synthetic two-question interaction fixtures; Docker only, not curriculum content.
with fixtures(n,game,title) as (values
 (10,'vocab_match','QA vocabulary'),(11,'fill_gap','QA gap choices'),
 (12,'tense_id','QA tense'),(13,'case_id','QA case'),
 (14,'adjective_agree','QA adjective'),(15,'adverb_use','QA adverb'),
 (16,'preposition_picture','QA picture'),(17,'translation','QA translation'),
 (18,'word_type_sort','QA word sort'),(19,'fill_gap','QA typed gap'))
insert into public.exercises(id,chapter_id,skill_id,title,game_type)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',title,game
from fixtures on conflict do nothing;

insert into public.exercises(id,chapter_id,skill_id,title,description,game_type,is_boss,position)
values (
  '40000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'QA boss round',
  'Synthetic local-only boss round for sampling checks.',
  'boss',
  true,
  999
) on conflict do nothing;

with fixtures(n,prompt,answer,options,metadata) as (values
 (10,'puella means…','girl','["girl","boy"]','{}'),
 (11,'puella ___: the girl loves','amat','["amat","amant"]','{}'),
 (12,'Identify the tense: amabat','imperfect','["imperfect","present"]','{}'),
 (13,'Identify the case: puellam','accusative','["accusative","nominative"]','{}'),
 (14,'Choose the adjective: puella ___','bona','["bona","bonus"]','{}'),
 (15,'Choose an adverb meaning quickly','celeriter','["celeriter","bonus"]','{}'),
 (16,'Choose the preposition: the dot is in the box','in','["in","sub"]','{"svg":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 100\"><rect x=\"40\" y=\"10\" width=\"120\" height=\"80\" fill=\"none\" stroke=\"black\"/><circle cx=\"100\" cy=\"50\" r=\"10\" fill=\"blue\"/></svg>","caption":"A dot inside a box"}'),
 (17,'Translate: puella amat','the girl loves','[]','{}'),
 (18,'Sort puella and amat','puella: noun; amat: verb','[]','{"words":[{"word":"puella","type":"noun"},{"word":"amat","type":"verb"}],"types":["noun","verb"]}'),
 (19,'Type the missing Latin word: puella ___ (loves)','amat','[]','{}'))
insert into public.exercise_questions(id,exercise_id,position,prompt,correct_answer,options,metadata)
select ('51000000-0000-4000-8000-'||lpad((n*100+j)::text,12,'0'))::uuid,
('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,j,
prompt||' [QA '||j||']',answer,options::jsonb,metadata::jsonb
from fixtures cross join generate_series(1,2) j on conflict do nothing;
