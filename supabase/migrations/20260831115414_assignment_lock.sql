-- Assignments never had an is_locked column at all — View Quiz has a
-- Lock/Unlock toggle (quizzes.is_locked, added earlier), Assignment
-- Grading had no equivalent. Mirrors the same simple flag; like the quiz
-- version, this is a visibility marker (shown as a badge) rather than an
-- RLS-enforced restriction — quizzes.is_locked isn't filtered on anywhere
-- server-side either, so this stays consistent with that existing,
-- shallower semantic rather than inventing a stricter one just for
-- assignments.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
