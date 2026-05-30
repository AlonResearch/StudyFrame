import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { randomUUID } from "~/lib/utils";
import { withDerivedStudyDomainModel, withRegeneratedStudyPracticeModel } from "./studyDomainModel";
import { requestStudyFeedback } from "./studyFeedback";
import { requestStudyGeneratedVariants } from "./studyGeneration";
import {
  checkDirection,
  createCompletionSummary,
  getBestAttempt,
  getHintCountForQuestion,
  getNextHint,
  getNextRealQuestion,
  getNotPerfectRealQuestions,
  getQuestionSupport,
  getQuestionsForTopicThread,
  gradeAnswer,
  isRealQuestionScopeExhausted,
  nextAttemptNumber,
  orderRealQuestionQueue,
  revealSolutionFeedback,
} from "./studyLogic";
import { studySeedData } from "./studySeedData";
import type {
  StudyAttempt,
  StudyCompletionSummary,
  StudyDataset,
  StudyFeedbackResult,
  StudyGeneratedQuestionBatch,
  StudyQuestion,
  StudyScope,
} from "./studyTypes";

const STORAGE_KEY = "studyframe:study-state:v1";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function initialSelectedTopicThreadId(dataset: StudyDataset) {
  return (
    [...dataset.topicThreads].sort((left, right) => right.priorityScore - left.priorityScore)[0]
      ?.id ?? null
  );
}

export interface StudyFrameStoreState {
  readonly dataset: StudyDataset;
  readonly attempts: readonly StudyAttempt[];
  readonly completionSummaries: readonly StudyCompletionSummary[];
  readonly generatedQuestionBatches: readonly StudyGeneratedQuestionBatch[];
  readonly selectedProjectId: string;
  readonly selectedTopicThreadId: string | null;
  readonly activeQuestionId: string | null;
  readonly answerDraftByQuestionId: Record<string, string>;
  readonly hintCountByQuestionId: Record<string, number>;
  readonly latestHintByQuestionId: Record<string, string>;
  readonly latestFeedbackByQuestionId: Record<string, StudyFeedbackResult>;
  readonly solutionOpenQuestionIds: Record<string, boolean>;
  readonly exhaustionSummaryId: string | null;
  readonly reviewModeTopicThreadId: string | null;
  readonly selectTopicThread: (topicThreadId: string) => void;
  readonly selectQuestion: (questionId: string) => void;
  readonly setAnswerDraft: (questionId: string, answer: string) => void;
  readonly requestHint: (questionId: string) => void;
  readonly checkDirection: (questionId: string) => void;
  readonly submitAnswer: (questionId: string) => void;
  readonly revealSolution: (questionId: string) => void;
  readonly moveToNextQuestion: () => void;
  readonly repeatAllRealQuestions: () => void;
  readonly repeatNotPerfectRealQuestions: () => void;
  readonly reviewSolutionsOnly: () => void;
  readonly generateSimilarQuestions: () => void;
  readonly dismissExhaustionSummary: () => void;
  readonly replaceDataset: (dataset: StudyDataset) => void;
  readonly resetStudyProgress: () => void;
}

const seedSelectedTopicThreadId = initialSelectedTopicThreadId(studySeedData);
const seedActiveQuestionId = seedSelectedTopicThreadId
  ? (getNextRealQuestion(studySeedData, [], seedSelectedTopicThreadId)?.id ?? null)
  : null;

export const useStudyFrameStore = create<StudyFrameStoreState>()(
  persist(
    (set, get) => ({
      dataset: studySeedData,
      attempts: [],
      completionSummaries: [],
      generatedQuestionBatches: [],
      selectedProjectId: studySeedData.projects[0]?.id ?? "",
      selectedTopicThreadId: seedSelectedTopicThreadId,
      activeQuestionId: seedActiveQuestionId,
      answerDraftByQuestionId: {},
      hintCountByQuestionId: {},
      latestHintByQuestionId: {},
      latestFeedbackByQuestionId: {},
      solutionOpenQuestionIds: {},
      exhaustionSummaryId: null,
      reviewModeTopicThreadId: null,

      selectTopicThread: (topicThreadId) => {
        const state = get();
        const nextQuestion = resolveNextQuestionForTopic(
          state.dataset,
          state.attempts,
          topicThreadId,
        );
        set({
          selectedTopicThreadId: topicThreadId,
          activeQuestionId: nextQuestion?.id ?? null,
          exhaustionSummaryId: null,
          reviewModeTopicThreadId: null,
        });
      },

      selectQuestion: (questionId) => {
        set({
          activeQuestionId: questionId,
          reviewModeTopicThreadId: null,
        });
      },

      setAnswerDraft: (questionId, answer) => {
        set((state) => ({
          answerDraftByQuestionId: {
            ...state.answerDraftByQuestionId,
            [questionId]: answer,
          },
        }));
      },

      requestHint: (questionId) => {
        const state = get();
        const support = getQuestionSupport(state.dataset, questionId);
        const currentHintCount = getHintCountForQuestion(state.hintCountByQuestionId, questionId);
        const hint = getNextHint({ support, currentHintCount });
        set({
          hintCountByQuestionId: {
            ...state.hintCountByQuestionId,
            [questionId]: currentHintCount + 1,
          },
          latestHintByQuestionId: {
            ...state.latestHintByQuestionId,
            [questionId]: hint,
          },
        });
      },

      checkDirection: (questionId) => {
        const state = get();
        const question = state.dataset.questions.find((candidate) => candidate.id === questionId);
        if (!question) return;
        const feedback = checkDirection({
          answer: state.answerDraftByQuestionId[questionId] ?? "",
          question,
          support: getQuestionSupport(state.dataset, questionId),
        });
        set({
          latestFeedbackByQuestionId: {
            ...state.latestFeedbackByQuestionId,
            [questionId]: feedback,
          },
        });
        void requestStudyFeedback({
          questionId,
          answer: state.answerDraftByQuestionId[questionId] ?? "",
          action: "check_direction",
        })
          .then((providerFeedback) => {
            if (!providerFeedback) return;
            set((current) => {
              if (current.latestFeedbackByQuestionId[questionId]?.tone !== "direction") {
                return current;
              }
              return {
                latestFeedbackByQuestionId: {
                  ...current.latestFeedbackByQuestionId,
                  [questionId]: providerFeedback,
                },
              };
            });
          })
          .catch(() => undefined);
      },

      submitAnswer: (questionId) => {
        const state = get();
        const question = state.dataset.questions.find((candidate) => candidate.id === questionId);
        const topicThreadId = state.selectedTopicThreadId;
        if (!question || !topicThreadId) return;

        const answer = state.answerDraftByQuestionId[questionId] ?? "";
        const feedback = gradeAnswer({
          answer,
          question,
          support: getQuestionSupport(state.dataset, questionId),
        });
        const attempt = makeAttempt({
          attempts: state.attempts,
          answer,
          feedback,
          questionId,
          topicThreadId,
          usedHintsCount: getHintCountForQuestion(state.hintCountByQuestionId, questionId),
          usedCheckDirection: state.latestFeedbackByQuestionId[questionId]?.tone === "direction",
        });
        const attempts = [...state.attempts, attempt];
        const exhaustionSummary = maybeCreateTopicExhaustionSummary({
          dataset: state.dataset,
          attempts,
          topicThreadId,
        });

        set({
          attempts,
          latestFeedbackByQuestionId: {
            ...state.latestFeedbackByQuestionId,
            [questionId]: feedback,
          },
          completionSummaries: exhaustionSummary
            ? [...state.completionSummaries, exhaustionSummary]
            : state.completionSummaries,
          exhaustionSummaryId: exhaustionSummary?.id ?? state.exhaustionSummaryId,
        });
        void requestStudyFeedback({
          questionId,
          answer,
          action: "grade_attempt",
        })
          .then((providerFeedback) => {
            if (!providerFeedback) return;
            set((current) =>
              applyProviderAttemptFeedback(current, attempt.id, questionId, providerFeedback),
            );
          })
          .catch(() => undefined);
      },

      revealSolution: (questionId) => {
        const state = get();
        const question = state.dataset.questions.find((candidate) => candidate.id === questionId);
        const topicThreadId = state.selectedTopicThreadId;
        if (!question || !topicThreadId) return;
        const feedback = revealSolutionFeedback({
          question,
          support: getQuestionSupport(state.dataset, questionId),
        });
        const attempt = makeAttempt({
          attempts: state.attempts,
          answer: state.answerDraftByQuestionId[questionId] ?? "",
          feedback,
          questionId,
          topicThreadId,
          usedHintsCount: getHintCountForQuestion(state.hintCountByQuestionId, questionId),
          usedCheckDirection: state.latestFeedbackByQuestionId[questionId]?.tone === "direction",
        });
        const attempts = [...state.attempts, attempt];
        const exhaustionSummary = maybeCreateTopicExhaustionSummary({
          dataset: state.dataset,
          attempts,
          topicThreadId,
        });
        set({
          attempts,
          latestFeedbackByQuestionId: {
            ...state.latestFeedbackByQuestionId,
            [questionId]: feedback,
          },
          solutionOpenQuestionIds: {
            ...state.solutionOpenQuestionIds,
            [questionId]: true,
          },
          completionSummaries: exhaustionSummary
            ? [...state.completionSummaries, exhaustionSummary]
            : state.completionSummaries,
          exhaustionSummaryId: exhaustionSummary?.id ?? state.exhaustionSummaryId,
        });
      },

      moveToNextQuestion: () => {
        const state = get();
        if (!state.selectedTopicThreadId) return;
        const currentQuestionId = state.activeQuestionId;
        const questions = orderRealQuestionQueue(
          state.dataset,
          getQuestionsForTopicThread(state.dataset, state.selectedTopicThreadId).filter(
            (question) => question.isRealQuestion,
          ),
          state.attempts,
        );
        const nextQuestion =
          questions.find(
            (question) =>
              question.id !== currentQuestionId && !getBestAttempt(state.attempts, question.id),
          ) ??
          questions.find((question) => question.id !== currentQuestionId) ??
          null;
        set({
          activeQuestionId: nextQuestion?.id ?? currentQuestionId ?? null,
          reviewModeTopicThreadId: null,
        });
      },

      repeatAllRealQuestions: () => {
        const state = get();
        if (!state.selectedTopicThreadId) return;
        const questions = orderRealQuestionQueue(
          state.dataset,
          getQuestionsForTopicThread(state.dataset, state.selectedTopicThreadId).filter(
            (question) => question.isRealQuestion,
          ),
          state.attempts,
        );
        set({
          activeQuestionId: questions[0]?.id ?? null,
          exhaustionSummaryId: null,
          reviewModeTopicThreadId: null,
        });
      },

      repeatNotPerfectRealQuestions: () => {
        const state = get();
        if (!state.selectedTopicThreadId) return;
        const questions = getNotPerfectRealQuestions(
          state.dataset,
          state.attempts,
          state.selectedTopicThreadId,
        );
        set({
          activeQuestionId: questions[0]?.id ?? null,
          exhaustionSummaryId: null,
          reviewModeTopicThreadId: null,
        });
      },

      reviewSolutionsOnly: () => {
        const state = get();
        set({
          exhaustionSummaryId: null,
          reviewModeTopicThreadId: state.selectedTopicThreadId,
        });
      },

      generateSimilarQuestions: () => {
        const state = get();
        const topicThreadId = state.selectedTopicThreadId;
        if (!topicThreadId) return;
        const exhausted = isRealQuestionScopeExhausted({
          dataset: state.dataset,
          attempts: state.attempts,
          scope: { kind: "topic", topicThreadId },
        });
        if (!exhausted) return;

        const sourceQuestions = getGenerationSourceQuestions(
          state.dataset,
          state.attempts,
          topicThreadId,
        );
        const batchId = makeId("generated-batch");
        const generatedAt = nowIso();
        const generatedQuestions = sourceQuestions.map((sourceQuestion, index) =>
          makeGeneratedQuestion(sourceQuestion, {
            id: `generated-${batchId}-${index + 1}`,
            createdAt: generatedAt,
          }),
        );
        const generatedTopics = generatedQuestions.flatMap((question) => {
          const sourceTopic = state.dataset.questionTopics.find(
            (topic) => topic.questionId === question.generatedFromQuestionIds[0],
          );
          if (!sourceTopic) return [];
          return [
            {
              ...sourceTopic,
              id: `generated-topic-${question.id}`,
              questionId: question.id,
            },
          ];
        });
        const generatedSupport = generatedQuestions.flatMap((question) => {
          const sourceSupport = getQuestionSupport(
            state.dataset,
            question.generatedFromQuestionIds[0] ?? "",
          );
          if (!sourceSupport) return [];
          return [
            {
              ...sourceSupport,
              id: `generated-support-${question.id}`,
              questionId: question.id,
              generatedAt,
            },
          ];
        });
        const batch: StudyGeneratedQuestionBatch = {
          id: batchId,
          projectId: state.selectedProjectId,
          topicThreadId,
          sourceQuestionIds: sourceQuestions.map((question) => question.id),
          generationReason: "exhausted_real_questions",
          createdAt: generatedAt,
        };

        set({
          dataset: withRegeneratedStudyPracticeModel({
            ...state.dataset,
            questions: [...state.dataset.questions, ...generatedQuestions],
            questionTopics: [...state.dataset.questionTopics, ...generatedTopics],
            questionSupport: [...state.dataset.questionSupport, ...generatedSupport],
          }),
          generatedQuestionBatches: [...state.generatedQuestionBatches, batch],
          activeQuestionId: generatedQuestions[0]?.id ?? state.activeQuestionId,
          exhaustionSummaryId: null,
          reviewModeTopicThreadId: null,
        });
        void requestStudyGeneratedVariants({
          topicThreadId,
          sourceQuestionIds: sourceQuestions.map((question) => question.id),
        })
          .then((result) => {
            const variants = result?.variants;
            if (!variants || variants.length === 0) return;
            const variantBySourceQuestionId = new Map(
              variants.map((variant) => [variant.sourceQuestionId, variant]),
            );
            const generatedQuestionIds = new Set(generatedQuestions.map((question) => question.id));
            set((current) => ({
              dataset: withRegeneratedStudyPracticeModel({
                ...current.dataset,
                questions: current.dataset.questions.map((question) => {
                  if (!generatedQuestionIds.has(question.id)) return question;
                  const sourceQuestionId = question.generatedFromQuestionIds[0];
                  const variant = sourceQuestionId
                    ? variantBySourceQuestionId.get(sourceQuestionId)
                    : undefined;
                  if (!variant) return question;
                  return {
                    ...question,
                    rawPrompt: variant.promptMarkdown,
                    normalizedPrompt: variant.promptMarkdown.trim().toLowerCase(),
                  };
                }),
              }),
              generatedQuestionBatches: current.generatedQuestionBatches.map((currentBatch) =>
                currentBatch.id === batchId
                  ? {
                      ...currentBatch,
                      generationMetadataJson: result.generationMetadataJson,
                    }
                  : currentBatch,
              ),
            }));
          })
          .catch(() => undefined);
      },

      dismissExhaustionSummary: () => {
        set({ exhaustionSummaryId: null });
      },

      replaceDataset: (dataset) => {
        const normalizedDataset = withDerivedStudyDomainModel(dataset);
        const selectedProjectId = normalizedDataset.projects[0]?.id ?? "";
        const selectedTopicThreadId = initialSelectedTopicThreadId(normalizedDataset);
        const activeQuestionId = selectedTopicThreadId
          ? (getNextRealQuestion(normalizedDataset, [], selectedTopicThreadId)?.id ?? null)
          : null;
        set({
          dataset: normalizedDataset,
          attempts: [],
          completionSummaries: [],
          generatedQuestionBatches: [],
          selectedProjectId,
          selectedTopicThreadId,
          activeQuestionId,
          answerDraftByQuestionId: {},
          hintCountByQuestionId: {},
          latestHintByQuestionId: {},
          latestFeedbackByQuestionId: {},
          solutionOpenQuestionIds: {},
          exhaustionSummaryId: null,
          reviewModeTopicThreadId: null,
        });
      },

      resetStudyProgress: () => {
        set({
          dataset: studySeedData,
          attempts: [],
          completionSummaries: [],
          generatedQuestionBatches: [],
          selectedProjectId: studySeedData.projects[0]?.id ?? "",
          selectedTopicThreadId: seedSelectedTopicThreadId,
          activeQuestionId: seedActiveQuestionId,
          answerDraftByQuestionId: {},
          hintCountByQuestionId: {},
          latestHintByQuestionId: {},
          latestFeedbackByQuestionId: {},
          solutionOpenQuestionIds: {},
          exhaustionSummaryId: null,
          reviewModeTopicThreadId: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        dataset: withDerivedStudyDomainModel(state.dataset),
        attempts: state.attempts,
        completionSummaries: state.completionSummaries,
        generatedQuestionBatches: state.generatedQuestionBatches,
        selectedProjectId: state.selectedProjectId,
        selectedTopicThreadId: state.selectedTopicThreadId,
        activeQuestionId: state.activeQuestionId,
        answerDraftByQuestionId: state.answerDraftByQuestionId,
        hintCountByQuestionId: state.hintCountByQuestionId,
        latestHintByQuestionId: state.latestHintByQuestionId,
        latestFeedbackByQuestionId: state.latestFeedbackByQuestionId,
        solutionOpenQuestionIds: state.solutionOpenQuestionIds,
        reviewModeTopicThreadId: state.reviewModeTopicThreadId,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<StudyFrameStoreState>;
        const merged = { ...current, ...persistedState };
        return {
          ...merged,
          dataset: withDerivedStudyDomainModel(merged.dataset),
        };
      },
    },
  ),
);

function resolveNextQuestionForTopic(
  dataset: StudyDataset,
  attempts: readonly StudyAttempt[],
  topicThreadId: string,
) {
  return (
    getNextRealQuestion(dataset, attempts, topicThreadId) ??
    getQuestionsForTopicThread(dataset, topicThreadId)[0] ??
    null
  );
}

function maybeCreateTopicExhaustionSummary(input: {
  readonly dataset: StudyDataset;
  readonly attempts: readonly StudyAttempt[];
  readonly topicThreadId: string;
}): StudyCompletionSummary | null {
  const scope: StudyScope = { kind: "topic", topicThreadId: input.topicThreadId };
  if (
    !isRealQuestionScopeExhausted({
      dataset: input.dataset,
      attempts: input.attempts,
      scope,
    })
  ) {
    return null;
  }

  return createCompletionSummary({
    dataset: input.dataset,
    attempts: input.attempts,
    scope,
    now: nowIso(),
    id: makeId("summary"),
  });
}

function makeAttempt(input: {
  readonly attempts: readonly StudyAttempt[];
  readonly answer: string;
  readonly feedback: StudyFeedbackResult;
  readonly questionId: string;
  readonly topicThreadId: string;
  readonly usedHintsCount: number;
  readonly usedCheckDirection: boolean;
}): StudyAttempt {
  return {
    id: makeId("attempt"),
    questionId: input.questionId,
    topicThreadId: input.topicThreadId,
    answer: input.answer,
    feedback: input.feedback,
    score: input.feedback.score,
    maxScore: input.feedback.maxScore,
    scorePercent: input.feedback.scorePercent,
    status: input.feedback.status,
    usedHintsCount: input.usedHintsCount,
    usedCheckDirection: input.usedCheckDirection,
    attemptNumber: nextAttemptNumber(input.attempts, input.questionId),
    createdAt: nowIso(),
  };
}

function applyProviderAttemptFeedback(
  state: StudyFrameStoreState,
  attemptId: string,
  questionId: string,
  feedback: StudyFeedbackResult,
): Partial<StudyFrameStoreState> {
  const attempts = state.attempts.map((attempt) =>
    attempt.id === attemptId
      ? {
          ...attempt,
          feedback,
          score: feedback.score,
          maxScore: feedback.maxScore,
          scorePercent: feedback.scorePercent,
          status: feedback.status,
        }
      : attempt,
  );
  const latestAttemptId = attempts.findLast((attempt) => attempt.questionId === questionId)?.id;
  const completionSummaries = state.completionSummaries.map((summary) => {
    if (summary.topicThreadId === null || summary.topicThreadId !== state.selectedTopicThreadId) {
      return summary;
    }
    return createCompletionSummary({
      dataset: state.dataset,
      attempts,
      scope: { kind: "topic", topicThreadId: summary.topicThreadId },
      now: summary.createdAt,
      id: summary.id,
    });
  });

  return {
    attempts,
    completionSummaries,
    ...(latestAttemptId === attemptId
      ? {
          latestFeedbackByQuestionId: {
            ...state.latestFeedbackByQuestionId,
            [questionId]: feedback,
          },
        }
      : {}),
  };
}

function getGenerationSourceQuestions(
  dataset: StudyDataset,
  attempts: readonly StudyAttempt[],
  topicThreadId: string,
): StudyQuestion[] {
  const realQuestions = getQuestionsForTopicThread(dataset, topicThreadId)
    .filter((question) => question.isRealQuestion)
    .sort((left, right) => (left.sourceYear ?? 0) - (right.sourceYear ?? 0));
  const perfectSolved = realQuestions.filter(
    (question) => (getBestAttempt(attempts, question.id)?.scorePercent ?? 0) >= 100,
  );
  const fallback = perfectSolved.length > 0 ? perfectSolved : realQuestions;
  return fallback.slice(0, Math.max(1, Math.min(2, fallback.length)));
}

function makeGeneratedQuestion(
  sourceQuestion: StudyQuestion,
  input: { readonly id: string; readonly createdAt: string },
): StudyQuestion {
  return {
    ...sourceQuestion,
    id: input.id,
    rawPrompt: `Generated variant based on ${sourceQuestion.sourceQuizLabel}: ${sourceQuestion.rawPrompt}`,
    normalizedPrompt: `Generated variant: ${sourceQuestion.normalizedPrompt}`,
    isRealQuestion: false,
    generatedFromQuestionIds: [sourceQuestion.id],
    sourceAnchor: `generated-from:${sourceQuestion.id}`,
    sourceQuizLabel: `Generated variant from ${sourceQuestion.sourceQuizLabel}`,
    sourceYear: null,
    extractionConfidence: 1,
    createdAt: input.createdAt,
  };
}
