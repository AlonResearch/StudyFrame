# StudyFrame

StudyFrame is a desktop study workspace that turns a course folder into a prioritized, spaced-learning plan built around problem-based learning (PBL).

Students select a local repository containing past exams, quizzes, lecture material, solutions, and supporting files. StudyFrame organizes the material into topics, gives a brief explanation of the core concepts, and guides the student through real past questions before offering generated practice.

This README is the product contract for builders. StudyFrame is under active development.

## Core Workflow

```text
Choose course folder
 -> extract questions and source context
 -> review warnings for unclear files or missing context
 -> analyze topics, subtopics, and exam frequency
 -> inspect the recommended study order
 -> choose a topic
 -> read a concise core-concept summary and formulas
 -> solve real past questions
 -> receive hints or feedback when needed
 -> review mistakes and revisit due or weak topics
 -> generate similar questions only after real questions are exhausted
 -> export reports or review material when useful
```

## Product Rules

- A project represents one course, subject, or exam repository.
- Topics are initially prioritized using recent exam frequency, recurrence, and point weight.
- After practice begins, the topic queue should adapt like a spaced-repetition flashcard system: important, weak, and due topics return more often while mastered topics return less often.
- Each topic includes a brief explanation, formulas, recurring question types, real questions, hints, solutions, traps, and progress.
- Real extracted questions always come before generated variants.
- Generated questions unlock only after the real questions in the selected scope are attempted. They must be labeled and scored separately.
- Before submit or reveal, never expose expected answers, rubric keywords, solution steps, or answer-revealing traps.
- Hints and direction checks should help without giving away the final answer.
- Every real question should retain its source document, year when available, anchor, linked assets, extraction confidence, and warnings.
- If an image, table, equation, or layout is required but unclear, show a warning instead of pretending the question is complete.
- Markdown is an optional export format, not the primary application state.

## Study Experience

The student should spend most of their time solving problems, not managing files or chatting with an agent.

StudyFrame combines:

- **Spaced learning:** topics return at useful intervals based on priority, performance, and time since review.
- **Problem-based learning:** the student learns by solving representative real problems.
- **Brief concept refreshers:** each topic begins with the minimum theory and formulas needed to start solving.

Opening a topic should immediately show:

1. A short theory summary.
2. Relevant formulas or reminders.
3. Subtopics and progress.
4. A queue of real past questions.
5. A focused answer area with hint, direction-check, submit, reveal, and next actions.
6. Source context in a drawer when needed.

After the real questions are exhausted, offer:

1. Repeat all real questions.
2. Repeat only questions below 100%.
3. Review solutions only.
4. Generate similar questions based on real questions.

Review and final reports should show real-question completion, weighted score, weak topics, weak subtopics, mistakes, revealed answers, hint usage, and recommended next steps.

## Priority And Review Order

The recommended queue should behave like a spaced-repetition deck for topics and problem types, not a static syllabus.

Ordering should consider:

- exam frequency and point weight
- recent exam emphasis
- previous scores
- incorrect or incomplete answers
- revealed solutions and hint usage
- time since the topic was last reviewed
- coverage of recurring problem types

When a topic returns, use new real questions when available. Repeat the full explanation only when needed; otherwise show a short reminder and move directly into problem solving.

## UX Direction

StudyFrame should feel like a quiet, structured study workspace.

- Keep the path from opening a topic to answering a question short.
- Preserve source context without leaking answers.
- Make warnings visible without blocking unrelated study.
- Use sidebars, panels, and drawers where they improve navigation.
- Keep real and generated questions visually distinct.
- Avoid chat-first, coding-agent, or internal-analysis UX.
- Keep the interface usable on a split screen and smaller displays.

## Example Validation Dataset

The primary golden example used while building StudyFrame is:

```text
G:\My Drive\Bar-Ilan\Signal and Data Analysis\Quiz
```

This is an external course dataset, not the StudyFrame application repository. It contains raw quizzes, lecture material, supporting files, generated exports, and prior extraction artifacts. StudyFrame must distinguish those roles correctly and avoid contaminating analysis with generated files.

## Builder Note

The inherited T3 Code foundation provides useful navigation, panels, drawers, persistence hooks, and provider connections. Reuse those foundations where they improve the study workflow, but do not preserve coding-agent UX that distracts from studying.

Keep implementation plans, schemas, migrations, and QA details in separate documents. When a technical shortcut conflicts with this README, preserve the student workflow.

## Technical Ground Truth

Use `groundtruth.md` for the traced implementation workflow, runtime topology, contracts,
persistence, environment specifications, validation pipeline, and current technical review risks.

Update `groundtruth.md` in the same change whenever a technical change alters runtime behavior, data
contracts, persistence, extraction, provider use, build or release pipelines, required environment
configuration, validation commands, or known technical risks. Update this README as well when the
student-facing product contract changes.
