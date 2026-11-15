-- Class context: what the student gives about a class, used whenever the AI
-- writes questions or solutions, grades an answer, or chats for that class.
--   context_notes  what the student wrote about the class
--   context_files  files they uploaded (worked solutions, rubrics...), kept as
--                  text: [{ id, name, content, summary }]. content is the whole
--                  file as text, summary is what it says about how answers
--                  must be written (the short version used when grading)
--   memory         short notes saved from the tutor chat
alter table public.courses
  add column if not exists context_notes text,
  add column if not exists context_files jsonb not null default '[]'::jsonb,
  add column if not exists memory text[] not null default '{}';
