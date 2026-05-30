import {
  createCompletionSummary,
  getAttemptsForQuestion,
  getBestAttempt,
  getQuestionSupport,
  getQuestionTopic,
  getQuestionsForTopicThread,
} from "./studyLogic";
import type {
  StudyAttempt,
  StudyDataset,
  StudyQuestion,
  StudyQuestionClassification,
  StudyTopicCluster,
  StudyTopicModule,
  StudyTopicThread,
} from "./studyTypes";

export function exportTopicPriorityReport(dataset: StudyDataset, projectId?: string): string {
  const project =
    dataset.projects.find((candidate) => candidate.id === projectId) ?? dataset.projects[0];
  const clusters = (dataset.topicClusters ?? [])
    .filter((cluster) => !project || cluster.projectId === project.id)
    .toSorted((left, right) => left.priorityRank - right.priorityRank);
  const lines = [
    "# Topic Priority Report",
    "",
    project ? `Course: ${project.name}` : "Course: StudyFrame project",
    "",
    "Priority is computed from recent question parts, older appearances, and detected point weights.",
    "",
    "## Priority Display",
    "",
    "| Rank | Topic cluster | Recent question-parts | Older appearances | Weighted points | Priority | Confidence |",
    "| ---: | --- | ---: | ---: | ---: | --- | ---: |",
  ];

  for (const cluster of clusters) {
    lines.push(
      `| ${cluster.priorityRank} | ${escapeCell(cluster.displayName)} | ${cluster.recentQuestionParts} | ${cluster.olderQuestionAppearances} | ${cluster.weightedPoints} | ${priorityLabel(cluster)} (${Math.round(cluster.priorityScore * 100)}) | ${Math.round(classificationConfidence(dataset.questionClassifications ?? [], cluster.id) * 100)}% |`,
    );
  }

  lines.push("", "## Subtopic Breakdown", "");
  for (const cluster of clusters) {
    lines.push(
      `### ${cluster.priorityRank}. ${cluster.displayName}`,
      "",
      cluster.priorityRationale,
      "",
      `Subtypes: ${cluster.subtypes.length > 0 ? cluster.subtypes.join(", ") : "none detected"}`,
      "",
    );
  }

  lines.push(
    "## Recommended Study Order",
    "",
    ...clusters.map((cluster) => `${cluster.priorityRank}. ${cluster.displayName}`),
    "",
  );

  if (project?.extractionWarnings.length) {
    lines.push(
      "## Source Warnings",
      "",
      ...project.extractionWarnings.map((warning) => `- ${warning}`),
      "",
    );
  }

  return lines.join("\n");
}

export function exportTopicThread(input: {
  readonly dataset: StudyDataset;
  readonly attempts: readonly StudyAttempt[];
  readonly topicThread: StudyTopicThread;
}): string {
  const questions = getQuestionsForTopicThread(input.dataset, input.topicThread.id);
  const module = getTopicModule(input.dataset, input.topicThread);
  const cluster = getTopicCluster(input.dataset, input.topicThread);
  const lines = [
    `# ${input.topicThread.displayName}`,
    "",
    `Priority: ${cluster ? `${priorityLabel(cluster)} (${Math.round(cluster.priorityScore * 100)})` : Math.round(input.topicThread.priorityScore * 100)}`,
    "",
    "## Brief Explanation",
    "",
    module?.theorySummaryMarkdown || input.topicThread.summary,
    "",
  ];

  if (module?.formulaSheetMarkdown.trim()) {
    lines.push("## Formula Reminders", "", module.formulaSheetMarkdown, "");
  }

  lines.push(
    "## Real Questions",
    "",
    "Try solving these before opening the solution sections.",
    "",
  );
  appendGroupedQuestions(lines, input.dataset, input.attempts, questions.filter(isRealQuestion));

  const generated = questions.filter((question) => !question.isRealQuestion);
  if (generated.length > 0) {
    lines.push(
      "## Generated Variants",
      "",
      "These are separate from real-question performance.",
      "",
    );
    appendGroupedQuestions(lines, input.dataset, input.attempts, generated);
  }

  appendModuleTraps(lines, module);
  return lines.join("\n");
}

export function exportReviewMaterial(input: {
  readonly dataset: StudyDataset;
  readonly attempts: readonly StudyAttempt[];
  readonly topicThread: StudyTopicThread;
}): string {
  const module = getTopicModule(input.dataset, input.topicThread);
  const questions = getQuestionsForTopicThread(input.dataset, input.topicThread.id).filter(
    (question) => question.isRealQuestion,
  );
  const reviewQuestions = questions.filter((question) => {
    const best = getBestAttempt(input.attempts, question.id);
    return !best || best.scorePercent < 100;
  });
  const lines = [
    `# ${input.topicThread.displayName} Review Material`,
    "",
    "## Theory Summary",
    "",
    module?.theorySummaryMarkdown || input.topicThread.summary,
    "",
  ];

  if (module?.formulaSheetMarkdown.trim()) {
    lines.push("## Formula Reminders", "", module.formulaSheetMarkdown, "");
  }
  appendModuleTraps(lines, module);
  lines.push(
    "## Questions To Review",
    "",
    reviewQuestions.length > 0
      ? "Focus on the questions below."
      : "No below-100% real questions remain.",
    "",
  );
  appendGroupedQuestions(lines, input.dataset, input.attempts, reviewQuestions);

  return lines.join("\n");
}

export function exportFinalReport(input: {
  readonly dataset: StudyDataset;
  readonly attempts: readonly StudyAttempt[];
  readonly projectId: string;
}): string {
  const project = input.dataset.projects.find((candidate) => candidate.id === input.projectId);
  const summary = createCompletionSummary({
    dataset: input.dataset,
    attempts: input.attempts,
    scope: { kind: "project", projectId: input.projectId },
    now: new Date().toISOString(),
    id: "export-final",
  });
  const threads = input.dataset.topicThreads
    .filter((thread) => thread.projectId === input.projectId)
    .toSorted((left, right) => right.priorityScore - left.priorityScore);
  const projectQuestions = input.dataset.questions.filter(
    (question) => question.projectId === input.projectId,
  );
  const missedQuestions = projectQuestions.filter((question) => {
    if (!question.isRealQuestion) return false;
    const best = getBestAttempt(input.attempts, question.id);
    return !best || best.scorePercent < 100;
  });
  const revealedQuestions = projectQuestions.filter((question) =>
    getAttemptsForQuestion(input.attempts, question.id).some(
      (attempt) => attempt.status === "revealed",
    ),
  );
  const hintsUsed = input.attempts
    .filter((attempt) => projectQuestions.some((question) => question.id === attempt.questionId))
    .reduce((total, attempt) => total + attempt.usedHintsCount, 0);
  const lines = [
    `# Final Report: ${project?.name ?? "StudyFrame Project"}`,
    "",
    "## Overview",
    "",
    `- Real questions attempted: ${summary.realQuestionsAttempted}`,
    `- Weighted real-question score: ${summary.weightedScorePercent}%`,
    `- Unweighted real-question score: ${summary.unweightedScorePercent}%`,
    `- Questions at 100%: ${summary.questions100Percent}`,
    `- Questions below 100%: ${summary.questionsNot100Percent}`,
    `- Revealed questions: ${revealedQuestions.length}`,
    `- Hint uses: ${hintsUsed}`,
    `- Generated questions attempted: ${summary.generatedQuestionsAttempted}`,
    `- Generated-question score: ${generatedScorePercent(input.dataset, input.attempts, input.projectId)}%`,
    `- Recommended next step: ${readableNextAction(summary.recommendedNextAction)}`,
    "",
    "## Topic Scores",
    "",
    "| Topic | Real questions attempted | Weighted score | Weak subtypes |",
    "| --- | ---: | ---: | --- |",
  ];

  for (const thread of threads) {
    const topicSummary = createCompletionSummary({
      dataset: input.dataset,
      attempts: input.attempts,
      scope: { kind: "topic", topicThreadId: thread.id },
      now: new Date().toISOString(),
      id: `export-${thread.id}`,
    });
    lines.push(
      `| ${escapeCell(thread.displayName)} | ${topicSummary.realQuestionsAttempted} | ${topicSummary.weightedScorePercent}% | ${escapeCell(topicSummary.weakSubtypes.join(", ") || "none")} |`,
    );
  }

  lines.push(
    "",
    "## Subtype Weaknesses",
    "",
    ...(summary.weakSubtypes.length > 0
      ? summary.weakSubtypes.map((subtype) => `- ${subtype}`)
      : ["- none"]),
    "",
    "## Missed Questions",
    "",
    ...questionList(missedQuestions),
    "",
    "## Revealed Questions",
    "",
    ...questionList(revealedQuestions),
    "",
  );

  return lines.join("\n");
}

export function exportScoreSummary(input: {
  readonly dataset: StudyDataset;
  readonly attempts: readonly StudyAttempt[];
  readonly projectId: string;
  readonly topicThreadId: string | null;
}): string {
  const scope = input.topicThreadId
    ? ({ kind: "topic", topicThreadId: input.topicThreadId } as const)
    : ({ kind: "project", projectId: input.projectId } as const);
  const summary = createCompletionSummary({
    dataset: input.dataset,
    attempts: input.attempts,
    scope,
    now: new Date().toISOString(),
    id: "export",
  });
  return [
    "# Real-Question Score Summary",
    "",
    `- Real questions attempted: ${summary.realQuestionsAttempted}`,
    `- Generated questions attempted: ${summary.generatedQuestionsAttempted}`,
    `- Weighted real-question score: ${summary.weightedScorePercent}%`,
    `- Unweighted real-question score: ${summary.unweightedScorePercent}%`,
    `- Generated-question score: ${generatedScorePercent(input.dataset, input.attempts, input.projectId, input.topicThreadId)}%`,
    `- Questions at 100%: ${summary.questions100Percent}`,
    `- Questions below 100%: ${summary.questionsNot100Percent}`,
    `- Questions revealed: ${summary.questionsRevealed}`,
    `- Recommended next action: ${readableNextAction(summary.recommendedNextAction)}`,
    `- Weak subtypes: ${summary.weakSubtypes.length > 0 ? summary.weakSubtypes.join(", ") : "none"}`,
    "",
  ].join("\n");
}

export function exportMistakesReview(input: {
  readonly dataset: StudyDataset;
  readonly attempts: readonly StudyAttempt[];
  readonly projectId?: string;
  readonly topicThread?: StudyTopicThread;
}): string {
  const questions = input.topicThread
    ? getQuestionsForTopicThread(input.dataset, input.topicThread.id)
    : input.dataset.questions.filter((question) => question.projectId === input.projectId);
  const reviewQuestions = questions.filter((question) => {
    if (!question.isRealQuestion) return false;
    const attempts = getAttemptsForQuestion(input.attempts, question.id);
    const best = getBestAttempt(input.attempts, question.id);
    return (
      attempts.some((attempt) => attempt.status === "revealed") || (best && best.scorePercent < 100)
    );
  });
  const lines = [
    "# Mistakes Review",
    "",
    input.topicThread ? `Topic: ${input.topicThread.displayName}` : "Project review",
    "",
  ];

  for (const question of reviewQuestions) {
    const best = getBestAttempt(input.attempts, question.id);
    const support = getQuestionSupport(input.dataset, question.id);
    lines.push(
      `## ${question.sourceQuizLabel}`,
      "",
      `- Best score: ${best?.scorePercent ?? 0}%`,
      `- Source: ${question.sourceAnchor}`,
      "",
      question.rawPrompt,
      "",
      "### Review Steps",
      "",
      ...(support?.solutionSteps ?? []).map((step, index) => `${index + 1}. ${step}`),
      "",
      "### Common Traps",
      "",
      ...(support?.commonMistakes.length
        ? support.commonMistakes.map((mistake) => `- ${mistake}`)
        : ["- No generated traps are available."]),
      "",
    );
  }

  if (reviewQuestions.length === 0) {
    lines.push("No below-100% or revealed real questions remain.", "");
  }

  return lines.join("\n");
}

function appendGroupedQuestions(
  lines: string[],
  dataset: StudyDataset,
  attempts: readonly StudyAttempt[],
  questions: readonly StudyQuestion[],
) {
  for (const [subtype, subtypeQuestions] of groupQuestionsBySubtype(dataset, questions)) {
    lines.push(`### ${subtype}`, "");
    for (const question of subtypeQuestions) {
      const support = getQuestionSupport(dataset, question.id);
      const bestAttempt = getBestAttempt(attempts, question.id);
      lines.push(
        `#### ${question.sourceQuizLabel}`,
        "",
        `- Source: ${question.sourceAnchor}`,
        `- Points: ${question.pointValue}`,
        `- Best score: ${bestAttempt ? `${bestAttempt.scorePercent}%` : "not attempted"}`,
        "",
        question.rawPrompt,
        "",
      );
      if (support && (support.solutionSteps.length > 0 || support.commonMistakes.length > 0)) {
        lines.push(
          "<details>",
          "<summary>Solution and traps</summary>",
          "",
          "##### Step-by-Step Solution",
          "",
          ...(support.solutionSteps.length > 0
            ? support.solutionSteps.map((step, index) => `${index + 1}. ${step}`)
            : ["No generated solution is available."]),
          "",
          "##### Common Traps",
          "",
          ...(support.commonMistakes.length > 0
            ? support.commonMistakes.map((mistake) => `- ${mistake}`)
            : ["- No generated traps are available."]),
          "",
          "</details>",
          "",
        );
      }
    }
  }
}

function appendModuleTraps(lines: string[], module: StudyTopicModule | null) {
  if (!module?.commonTrapsMarkdown.trim()) return;
  lines.push("## Common Traps", "", module.commonTrapsMarkdown, "");
}

function groupQuestionsBySubtype(
  dataset: StudyDataset,
  questions: readonly StudyQuestion[],
): Array<readonly [string, readonly StudyQuestion[]]> {
  const groups = new Map<string, StudyQuestion[]>();
  for (const question of questions) {
    const subtype = getQuestionTopic(dataset, question.id)?.subtype ?? "Unclassified";
    const entries = groups.get(subtype) ?? [];
    entries.push(question);
    groups.set(subtype, entries);
  }
  return [...groups.entries()].toSorted(([left], [right]) => left.localeCompare(right));
}

function getTopicModule(
  dataset: StudyDataset,
  topicThread: StudyTopicThread,
): StudyTopicModule | null {
  const cluster = getTopicCluster(dataset, topicThread);
  return dataset.topicModules?.find((module) => module.topicClusterId === cluster?.id) ?? null;
}

function getTopicCluster(
  dataset: StudyDataset,
  topicThread: StudyTopicThread,
): StudyTopicCluster | null {
  return (
    dataset.topicClusters?.find(
      (cluster) =>
        cluster.projectId === topicThread.projectId &&
        cluster.displayName === topicThread.displayName,
    ) ?? null
  );
}

function classificationConfidence(
  classifications: readonly StudyQuestionClassification[],
  topicClusterId: string,
): number {
  const matching = classifications.filter(
    (classification) => classification.topicClusterId === topicClusterId,
  );
  if (matching.length === 0) return 0;
  return (
    matching.reduce((total, classification) => total + classification.confidence, 0) /
    matching.length
  );
}

function generatedScorePercent(
  dataset: StudyDataset,
  attempts: readonly StudyAttempt[],
  projectId: string,
  topicThreadId?: string | null,
): number {
  const questions = topicThreadId
    ? getQuestionsForTopicThread(dataset, topicThreadId)
    : dataset.questions.filter((question) => question.projectId === projectId);
  const scores = questions
    .filter((question) => !question.isRealQuestion)
    .flatMap((question) => {
      const best = getBestAttempt(attempts, question.id);
      return best ? [best.scorePercent] : [];
    });
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
}

function questionList(questions: readonly StudyQuestion[]): string[] {
  return questions.length > 0
    ? questions.map((question) => `- ${question.sourceQuizLabel}: ${question.sourceAnchor}`)
    : ["- none"];
}

function priorityLabel(cluster: StudyTopicCluster): string {
  return cluster.priorityLabel.replaceAll("_", " ");
}

function readableNextAction(action: string): string {
  return action.replaceAll("_", " ");
}

function isRealQuestion(question: StudyQuestion): boolean {
  return question.isRealQuestion;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}
