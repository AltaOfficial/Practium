-- Flashcards: a deck (public.flashcards) and its cards (public.flashcard).
--   flashcards.name         the name of the deck
--   flashcards.user_id      the Clerk id of the student who owns it
--   flashcards.course_id    the class it is in (the same classes the tests are in)
--   flashcards.total_cards  how many cards it has
--   flashcard.deck_id       the deck the card is in (cards are deleted with their deck)
--   flashcard.position      the order of the card in the deck
--   flashcard.term          the front of the card
--   flashcard.definition    the back of the card
-- Safe to run more than once.
alter table public.flashcards
  add column if not exists name text,
  add column if not exists user_id text,
  add column if not exists course_id bigint references public.courses (id) on delete cascade,
  add column if not exists total_cards integer not null default 0;

alter table public.flashcard
  add column if not exists deck_id bigint references public.flashcards (id) on delete cascade,
  add column if not exists position integer not null default 0;

-- definition was json, it is plain text
do $$
begin
  if (
    select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'flashcard' and column_name = 'definition'
  ) in ('json', 'jsonb') then
    alter table public.flashcard alter column definition type text using definition #>> '{}';
  end if;
end $$;

create index if not exists flashcards_user_id_idx on public.flashcards (user_id);
create index if not exists flashcards_course_id_idx on public.flashcards (course_id);
create index if not exists flashcard_deck_id_idx on public.flashcard (deck_id);

-- Like the other tables, these are only reached from the servers (Next.js server actions and
-- the Flask backend), which check who the user is themselves. If your other tables use row
-- level security policies instead, remove these two lines and add the same policies here.
alter table public.flashcards disable row level security;
alter table public.flashcard disable row level security;
