-- Edit list #1: an "Archived" tab for quizzes (view/reactivate/delete),
-- with archived quizzes AND assignments also surfaced under a classroom's
-- Past Questions tab.
--
-- Finding while investigating: quizzes.is_deleted was already being used
-- for two different things at once. useArchiveQuiz/useUnarchiveQuiz (wired
-- to the "Archive" button in ViewQuizDialog, and the "Archived" badge)
-- set/read is_deleted — so "archiving" a quiz was actually soft-deleting
-- it, indistinguishable from real deletion and invisible everywhere
-- (excluded by every query's `.eq('is_deleted', false)`, including Past
-- Questions). That's the root cause of "archived quizzes don't show up
-- anywhere" — there was never a state that meant "archived but browsable."
-- This adds a real is_archived column, separate from is_deleted, and the
-- application-layer changes repoint useArchiveQuiz/useUnarchiveQuiz at it
-- (leaving is_deleted as genuine soft-delete, driven by new
-- useDeleteQuiz/useRestoreQuiz for the new Archived tab's "Delete" action).

ALTER TABLE public.quizzes
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.assignments
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Cheap filters for the Archived tab / Past Questions queries.
CREATE INDEX idx_quizzes_is_archived ON public.quizzes (classroom_id, is_archived) WHERE is_archived = true;
CREATE INDEX idx_assignments_is_archived ON public.assignments (classroom_id, is_archived) WHERE is_archived = true;
