-- Multi-part questions: each part is its own row in questions.
-- Rows of one assessment that share a group_number are the parts of one
-- question, and context holds the setup they share. Both stay null for
-- standalone questions.
alter table public.questions
  add column if not exists group_number integer,
  add column if not exists context text;
