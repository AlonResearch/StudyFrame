import {
  createCompletionSummary,
  getBestAttempt,
  getQuestionSupport,
  getQuestionTopic,
  getQuestionsForTopicThread,
} from "./studyLogic";
import type { StudyAttempt, StudyDataset, StudyTopicThread } from "./studyTypes";

export function exportTopicPriorityReport(dataset: StudyDataset): string {
  const lines = [
    "# Topic Priority Report",
    "",
    "| Topic | Priority | Real questions | Generated variants |",
    "| --- | ---: | ---: | ---: |",
  ];
  for (const thread of [...dataset.topicThreads].sort(
    (left, right) => right.priorityScore - left.priorityScore,
  )) {
    const questions = getQuestionsForTopicThread(dataset, thread.id);
    lines.push(
      `| ${escapeCell(thread.displayName)} | ${Math.round(thread.priorityScore * 100)} | ${
        questions.filter((question) => question.isRealQuestion).length
      } | ${questions.filter((question) => !question.isRealQuestion).length} |`,
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
  const lines = [
    `# ${input.topicThread.displayName}`,
    "",
    input.topicThread.summary,
    "",
    "## Real Questions",
    "",
  ];
  for (const question of questions.filter((entry) => entry.isRealQuestion)) {
    const topic = getQuestionTopic(input.dataset, question.id);
    const support = getQuestionSupport(input.dataset, question.id);
    const bestAttempt = getBestAttempt(input.attempts, question.id);
    lines.push(
      `### ${question.sourceQuizLabel}`,
      "",
      `- Source: ${question.sourceAnchor}`,
      `- Subtype: ${topic?.subtype ?? "Unclassified"}`,
      `- Points: ${question.pointValue}`,
      `- Best score: ${bestAttempt ? `${bestAttempt.scorePercent}%` : "not attempted"}`,
      "",
      question.rawPrompt,
      "",
    );
    if (support?.solutionSteps.length) {
      lines.push(
        "Solution:",
        "",
        ...support.solutionSteps.map((step, index) => `${index + 1}. ${step}`),
        "",
      );
    }
  }

  const generated = questions.filter((entry) => !entry.isRealQuestion);
  if (generated.length > 0) {
    lines.push("## Generated Variants", "");
    for (const question of generated) {
      lines.push(`### ${question.sourceQuizLabel}`, "", question.rawPrompt, "");
    }
  }

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
    `- Questions at 100%: ${summary.questions100Percent}`,
    `- Questions below 100%: ${summary.questionsNot100Percent}`,
    `- Questions revealed: ${summary.questionsRevealed}`,
    `- Recommended next action: ${summary.recommendedNextAction}`,
    `- Weak subtypes: ${summary.weakSubtypes.length > 0 ? summary.weakSubtypes.join(", ") : "none"}`,
    "",
  ].join("\n");
}

export function exportMistakesReview(input: {
  readonly dataset: StudyDataset;
  readonly attempts: readonly StudyAttempt[];
  readonly topicThread: StudyTopicThread;
}): string {
  const questions = getQuestionsForTopicThread(input.dataset, input.topicThread.id).filter(
    (question) => {
      const best = getBestAttempt(input.attempts, question.id);
      return best && best.scorePercent < 100;
    },
  );
  const lines = ["# Mistakes Review", "", `Topic: ${input.topicThread.displayName}`, ""];
  for (const question of questions) {
    const best = getBestAttempt(input.attempts, question.id);
    const support = getQuestionSupport(input.dataset, question.id);
    lines.push(
      `## ${question.sourceQuizLabel}`,
      "",
      `Best score: ${best?.scorePercent ?? 0}%`,
      "",
      question.rawPrompt,
      "",
      "Review steps:",
      "",
      ...(support?.solutionSteps ?? []).map((step, index) => `${index + 1}. ${step}`),
      "",
    );
  }
  return lines.join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}
