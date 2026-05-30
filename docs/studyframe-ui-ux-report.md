# StudyFrame UI/UX Audit

Scope: README product contract and the Chromium-backed browser workflow in
`apps/web/src/components/study/StudyWorkspace.browser.tsx`.

## What Works

- The workspace opens directly into a prioritized topic, short theory summary, formula reminders,
  real-question queue, answer area, and source context.
- Expected answers, support summaries, solution steps, and common mistakes stay hidden before
  submit or reveal.
- Generated practice is disabled until the selected topic's real questions are attempted and is
  labeled separately after generation.
- Completion actions cover repeat-all, repeat-not-100%, generated variants, and solution review.
- Source metadata, extraction confidence, warnings, and markdown reports are available.

## Recommended UI/UX Changes

### High Priority

1. Move the seven project metrics and the full topic-priority table behind a compact overview
   disclosure after the first visit. They push the active question below the fold, while the README
   says students should spend most of their time solving problems.
2. Replace the always-visible markdown export stack with a single `Export` menu. Six buttons in the
   source panel compete with the question controls and are secondary to the study loop.
3. Show all extraction warnings in a review drawer with per-warning context and a count badge.
   Currently the sidebar shows a count while the source panel shows only the first warning.
4. Rename `Reset demo progress` for non-demo datasets and add a confirmation dialog. The current
   label is inaccurate after importing a real course, and the action is destructive.

### Medium Priority

5. Add an explicit progress step near the question controls, such as `Real question 1 of 2`.
   The queue communicates progress indirectly, but the answer area does not.
6. Visually separate `Reveal solution` from `Hint`, `Check direction`, and `Submit`; add a brief
   confirmation because reveal records an attempt and affects spaced-review priority.
7. Make the source-context panel collapsible on narrower layouts. Preserve source access without
   forcing the answer area to share width on split screens.
8. Add labels for the course-folder field and JSON textarea in the import dialog. Placeholder-only
   fields are harder to scan and weaker for accessibility.

### Lower Priority

9. Change internal wording such as `Topic clusters`, `analysis output`, and `support confidence`
   into student-facing language or tooltips.
10. Provide an empty-state explanation when generated practice is locked: state how many real
    questions remain instead of relying only on a disabled button.
11. Add formula-sheet content to the seeded and golden study topics. The UI supports formula
    reminders, but the current seed workflow does not demonstrate them.

## Browser Coverage Added

- Prioritized workspace rendering and source grounding.
- No answer leakage before submit or reveal.
- Hint, direction check, answer submission, feedback, and attempt history.
- Next-question navigation and real-question exhaustion.
- Generated-question unlock gating and separate labeling.
- Solution-review mode.
- Markdown export triggers.
- Example JSON course import and demo reset.
