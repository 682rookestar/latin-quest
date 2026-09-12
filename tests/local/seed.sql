-- Dummy learning content only. This runs exclusively in the QA Docker container.
insert into public.chapters(id,number,title) values
('10000000-0000-4000-8000-000000000001',1,'QA chapter') on conflict do nothing;
insert into public.skills(id,code,display_name) values
('20000000-0000-4000-8000-000000000001','qa-vocabulary','QA vocabulary') on conflict do nothing;
insert into public.classes(id,teacher_id,name,join_code,join_code_expires_at)
select '30000000-0000-4000-8000-000000000001',id,'QA Class — dummy pupils only','ABCDEFGHJK',now()+interval '365 days'
from public.profiles where email='qa.teacher@hallifordschool.co.uk' on conflict do nothing;
insert into public.class_members(class_id,student_id)
select '30000000-0000-4000-8000-000000000001',id from public.profiles
where email in ('qa.pupil1@hallifordschool.co.uk','qa.pupil2@hallifordschool.co.uk') on conflict do nothing;
insert into public.exercises(id,chapter_id,skill_id,title,game_type)
values('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','QA 20-question test','multiple_choice') on conflict do nothing;
insert into public.exercise_questions(id,exercise_id,position,prompt,correct_answer,options)
select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
'40000000-0000-4000-8000-000000000001',n,'QA question '||n||': puella means…','girl','["girl","boy","king","queen"]'::jsonb
from generate_series(1,20) n on conflict do nothing;
