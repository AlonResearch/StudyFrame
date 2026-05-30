import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BookMarkedIcon,
  ChartNoAxesColumnIncreasingIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CompassIcon,
  EyeIcon,
  FileDownIcon,
  FileTextIcon,
  HistoryIcon,
  ImageIcon,
  LightbulbIcon,
  ListTreeIcon,
  ListRestartIcon,
  NotebookTabsIcon,
  RotateCcwIcon,
  SigmaIcon,
  SparklesIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { StudyMarkdown } from "~/components/study/StudyMarkdown";
import {
  exportFinalReport,
  exportMistakesReview,
  exportReviewMaterial,
  exportScoreSummary,
  exportTopicPriorityReport,
  exportTopicThread,
} from "~/study/studyExport";
import {
  createCompletionSummary,
  getAttemptsForQuestion,
  getBestAttempt,
  getNotPerfectRealQuestions,
  getQuestionSupport,
  getQuestionTopic,
  getQuestionsForTopicThread,
  getUnattemptedRealQuestions,
  isQuestionAttempted,
  isRealQuestionScopeExhausted,
} from "~/study/studyLogic";
import { useStudyFrameStore } from "~/study/studyStore";
import { getStudySupportVisibility, getVisibleSourceContextSupport } from "~/study/studyVisibility";
import { installStudyFrameServerSync } from "~/study/studyServerSync";
import type {
  StudyCompletionSummary,
  StudyAnswerInputType,
  StudyAttempt,
  StudyDataset,
  StudyQuestionClassification,
  StudyQuestion,
  StudySourceAsset,
  StudyTopicCluster,
  StudyTopicModule,
} from "~/study/studyTypes";
import { APP_DISPLAY_NAME } from "~/branding";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";

export function StudyWorkspace() {
  useEffect(() => {
    installStudyFrameServerSync();
  }, []);

  const dataset = useStudyFrameStore((state) => state.dataset);
  const attempts = useStudyFrameStore((state) => state.attempts);
  const selectedProjectId = useStudyFrameStore((state) => state.selectedProjectId);
  const selectedTopicThreadId = useStudyFrameStore((state) => state.selectedTopicThreadId);
  const activeQuestionId = useStudyFrameStore((state) => state.activeQuestionId);
  const answerDraftByQuestionId = useStudyFrameStore((state) => state.answerDraftByQuestionId);
  const latestHintByQuestionId = useStudyFrameStore((state) => state.latestHintByQuestionId);
  const latestFeedbackByQuestionId = useStudyFrameStore(
    (state) => state.latestFeedbackByQuestionId,
  );
  const solutionOpenQuestionIds = useStudyFrameStore((state) => state.solutionOpenQuestionIds);
  const completionSummaries = useStudyFrameStore((state) => state.completionSummaries);
  const exhaustionSummaryId = useStudyFrameStore((state) => state.exhaustionSummaryId);
  const reviewModeTopicThreadId = useStudyFrameStore((state) => state.reviewModeTopicThreadId);
  const setAnswerDraft = useStudyFrameStore((state) => state.setAnswerDraft);
  const selectQuestion = useStudyFrameStore((state) => state.selectQuestion);
  const requestHint = useStudyFrameStore((state) => state.requestHint);
  const checkDirection = useStudyFrameStore((state) => state.checkDirection);
  const submitAnswer = useStudyFrameStore((state) => state.submitAnswer);
  const revealSolution = useStudyFrameStore((state) => state.revealSolution);
  const moveToNextQuestion = useStudyFrameStore((state) => state.moveToNextQuestion);
  const repeatAllRealQuestions = useStudyFrameStore((state) => state.repeatAllRealQuestions);
  const repeatNotPerfectRealQuestions = useStudyFrameStore(
    (state) => state.repeatNotPerfectRealQuestions,
  );
  const reviewSolutionsOnly = useStudyFrameStore((state) => state.reviewSolutionsOnly);
  const generateSimilarQuestions = useStudyFrameStore((state) => state.generateSimilarQuestions);
  const dismissExhaustionSummary = useStudyFrameStore((state) => state.dismissExhaustionSummary);

  const project = dataset.projects.find((candidate) => candidate.id === selectedProjectId) ?? null;
  const topicThread =
    dataset.topicThreads.find((candidate) => candidate.id === selectedTopicThreadId) ?? null;
  const activeQuestion =
    dataset.questions.find((question) => question.id === activeQuestionId) ?? null;
  const activeSupport = activeQuestion ? getQuestionSupport(dataset, activeQuestion.id) : null;
  const activeTopic = activeQuestion ? getQuestionTopic(dataset, activeQuestion.id) : null;
  const activeCandidate =
    activeQuestion && dataset.questionCandidates
      ? dataset.questionCandidates.find(
          (candidate) =>
            candidate.documentId === activeQuestion.documentId &&
            candidate.sourceAnchor === activeQuestion.sourceAnchor,
        )
      : null;
  const activePracticeItem =
    dataset.practiceItems?.find((item) => item.sourceQuestionCandidateId === activeCandidate?.id) ??
    null;
  const activeSourceAssets = activeCandidate
    ? (dataset.sourceAssets ?? []).filter((asset) => activeCandidate.assetIds.includes(asset.id))
    : [];
  const topicQuestions = topicThread ? getQuestionsForTopicThread(dataset, topicThread.id) : [];
  const realQuestions = topicQuestions.filter((question) => question.isRealQuestion);
  const generatedQuestions = topicQuestions.filter((question) => !question.isRealQuestion);
  const topicCluster =
    dataset.topicClusters?.find(
      (cluster) =>
        cluster.projectId === selectedProjectId && cluster.displayName === topicThread?.displayName,
    ) ?? null;
  const topicModule =
    dataset.topicModules?.find((module) => module.topicClusterId === topicCluster?.id) ?? null;
  const subtypeGroups = getSubtypeGroups(dataset, realQuestions);
  const unattemptedRealQuestions = topicThread
    ? getUnattemptedRealQuestions(dataset, attempts, topicThread.id)
    : [];
  const notPerfectRealQuestions = topicThread
    ? getNotPerfectRealQuestions(dataset, attempts, topicThread.id)
    : [];
  const topicExhausted =
    topicThread !== null &&
    isRealQuestionScopeExhausted({
      dataset,
      attempts,
      scope: { kind: "topic", topicThreadId: topicThread.id },
    });
  const topicSummary = useMemo(
    () =>
      topicThread
        ? createCompletionSummary({
            dataset,
            attempts,
            scope: { kind: "topic", topicThreadId: topicThread.id },
            now: new Date(0).toISOString(),
            id: "live-topic-summary",
          })
        : null,
    [attempts, dataset, topicThread],
  );
  const projectSummary = useMemo(
    () =>
      createCompletionSummary({
        dataset,
        attempts,
        scope: { kind: "project", projectId: selectedProjectId },
        now: new Date(0).toISOString(),
        id: "live-project-summary",
      }),
    [attempts, dataset, selectedProjectId],
  );
  const exhaustionSummary =
    completionSummaries.find((summary) => summary.id === exhaustionSummaryId) ?? null;
  const answerDraft = activeQuestion ? (answerDraftByQuestionId[activeQuestion.id] ?? "") : "";
  const latestHint = activeQuestion ? latestHintByQuestionId[activeQuestion.id] : undefined;
  const latestFeedback = activeQuestion ? latestFeedbackByQuestionId[activeQuestion.id] : undefined;
  const solutionOpen = activeQuestion ? solutionOpenQuestionIds[activeQuestion.id] === true : false;
  const supportVisibility = getStudySupportVisibility({
    questionId: activeQuestion?.id ?? null,
    attempts,
    solutionOpen,
    reviewMode: reviewModeTopicThreadId === selectedTopicThreadId,
  });
  const sourceContextSupport = getVisibleSourceContextSupport({
    supportSummary: activeSupport?.summaryContext ?? null,
    expectedAnswer: activeSupport?.expectedAnswer ?? [],
    visibility: supportVisibility,
  });
  const exportName = (project?.name ?? "studyframe").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground md:h-dvh">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <StudyHeader projectName={project?.name ?? APP_DISPLAY_NAME} />
        <ScrollArea className="flex-1">
          <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6">
            <ProjectDashboard
              projectSummary={projectSummary}
              sourceDocumentCount={dataset.sourceDocuments?.length ?? dataset.documents.length}
              questionCandidateCount={dataset.questionCandidates?.length ?? 0}
              realQuestionCount={
                dataset.questions.filter((question) => question.isRealQuestion).length
              }
              generatedQuestionCount={
                dataset.questions.filter((question) => !question.isRealQuestion).length
              }
              topicClusterCount={dataset.topicClusters?.length ?? dataset.topicThreads.length}
              dueTopicCount={
                dataset.topicThreads.filter(
                  (thread) => getUnattemptedRealQuestions(dataset, attempts, thread.id).length > 0,
                ).length
              }
              warningCount={project?.extractionWarnings.length ?? 0}
            />

            {dataset.topicClusters && dataset.topicClusters.length > 0 ? (
              <PriorityOverview
                clusters={dataset.topicClusters.filter(
                  (cluster) => cluster.projectId === selectedProjectId,
                )}
                classifications={dataset.questionClassifications ?? []}
              />
            ) : null}

            {topicThread ? (
              <TopicHeader
                topicName={topicThread.displayName}
                priorityScore={topicThread.priorityScore}
                summary={topicThread.summary}
                realQuestionCount={realQuestions.length}
                attemptedRealQuestionCount={
                  realQuestions.filter((question) => isQuestionAttempted(attempts, question.id))
                    .length
                }
                generatedQuestionCount={generatedQuestions.length}
                averageScore={topicSummary?.weightedScorePercent ?? 0}
                weakSubtypes={topicSummary?.weakSubtypes ?? []}
              />
            ) : null}

            {topicModule && subtypeGroups.length > 0 ? (
              <TopicModuleOverview
                topicModule={topicModule}
                subtypeGroups={subtypeGroups}
                attempts={attempts}
                activeQuestionId={activeQuestionId}
                onSelectQuestion={selectQuestion}
              />
            ) : null}

            <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <section className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">
                {reviewModeTopicThreadId && topicThread ? (
                  <ReviewSolutionsPanel
                    questions={
                      notPerfectRealQuestions.length > 0 ? notPerfectRealQuestions : realQuestions
                    }
                    attempts={attempts}
                    getSupport={(questionId) => getQuestionSupport(dataset, questionId)}
                  />
                ) : activeQuestion ? (
                  <QuestionPracticePanel
                    question={activeQuestion}
                    subtype={activeTopic?.subtype ?? "Unclassified"}
                    supportConfidence={activeSupport?.supportConfidence ?? 0}
                    answerDraft={answerDraft}
                    latestHint={latestHint}
                    latestFeedback={latestFeedback}
                    solutionVisible={supportVisibility.solutionVisible}
                    solutionSteps={
                      supportVisibility.solutionVisible ? (activeSupport?.solutionSteps ?? []) : []
                    }
                    commonMistakes={
                      supportVisibility.commonMistakesVisible
                        ? (activeSupport?.commonMistakes ?? [])
                        : []
                    }
                    bestAttempt={getBestAttempt(attempts, activeQuestion.id)}
                    attempts={getAttemptsForQuestion(attempts, activeQuestion.id)}
                    answerInputType={activePracticeItem?.answerInputType ?? "free_text"}
                    onAnswerDraftChange={(answer) => setAnswerDraft(activeQuestion.id, answer)}
                    onHint={() => requestHint(activeQuestion.id)}
                    onCheckDirection={() => checkDirection(activeQuestion.id)}
                    onSubmit={() => submitAnswer(activeQuestion.id)}
                    onRevealSolution={() => revealSolution(activeQuestion.id)}
                    onNext={moveToNextQuestion}
                  />
                ) : (
                  <EmptyPracticeState topicExhausted={topicExhausted} />
                )}
              </section>

              <aside className="min-w-0 rounded-lg border border-border bg-card text-card-foreground">
                <SourceContextPanel
                  question={activeQuestion}
                  documentTitle={
                    activeQuestion
                      ? (dataset.documents.find(
                          (document) => document.id === activeQuestion.documentId,
                        )?.title ?? null)
                      : null
                  }
                  supportSummary={sourceContextSupport.supportSummary}
                  expectedAnswer={sourceContextSupport.expectedAnswer}
                  extractionWarnings={project?.extractionWarnings ?? []}
                  sourceAssets={activeSourceAssets}
                  realQuestionsRemaining={unattemptedRealQuestions.length}
                  notPerfectCount={notPerfectRealQuestions.length}
                  generationEnabled={topicExhausted}
                  onGenerateSimilar={generateSimilarQuestions}
                  onExportPriority={() =>
                    downloadMarkdown("topic_priority_report.md", exportTopicPriorityReport(dataset))
                  }
                  onExportSummary={() =>
                    downloadMarkdown(
                      "score_summary.md",
                      exportScoreSummary({
                        dataset,
                        attempts,
                        projectId: selectedProjectId,
                        topicThreadId: topicThread?.id ?? null,
                      }),
                    )
                  }
                  onExportFinal={() =>
                    downloadMarkdown(
                      `final_report_${exportName}.md`,
                      exportFinalReport({ dataset, attempts, projectId: selectedProjectId }),
                    )
                  }
                  onExportTopic={
                    topicThread
                      ? () =>
                          downloadMarkdown(
                            `${exportName}-${topicThread.id}.md`,
                            exportTopicThread({ dataset, attempts, topicThread }),
                          )
                      : null
                  }
                  onExportReviewMaterial={
                    topicThread
                      ? () =>
                          downloadMarkdown(
                            `${exportName}-${topicThread.id}-review-material.md`,
                            exportReviewMaterial({ dataset, attempts, topicThread }),
                          )
                      : null
                  }
                  onExportMistakes={
                    topicThread
                      ? () =>
                          downloadMarkdown(
                            "mistakes_review.md",
                            exportMistakesReview({ dataset, attempts, topicThread }),
                          )
                      : null
                  }
                />
              </aside>
            </div>
          </main>
        </ScrollArea>
      </div>

      <ExhaustionDialog
        summary={exhaustionSummary}
        open={exhaustionSummary !== null}
        onOpenChange={(open) => {
          if (!open) dismissExhaustionSummary();
        }}
        onRepeatAll={repeatAllRealQuestions}
        onRepeatNotPerfect={repeatNotPerfectRealQuestions}
        onGenerateSimilar={generateSimilarQuestions}
        onReviewSolutions={reviewSolutionsOnly}
      />
    </SidebarInset>
  );
}

function StudyHeader({ projectName }: { projectName: string }) {
  return (
    <header
      className={cn(
        "border-b border-border px-3 sm:px-5",
        isElectron
          ? "drag-region flex h-[52px] items-center wco:h-[env(titlebar-area-height)]"
          : "py-2 sm:py-3",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {!isElectron ? <SidebarTrigger className="size-7 shrink-0 md:hidden" /> : null}
        <span className="truncate text-sm font-medium text-foreground md:text-muted-foreground/70">
          {projectName}
        </span>
      </div>
    </header>
  );
}

function ProjectDashboard({
  projectSummary,
  sourceDocumentCount,
  questionCandidateCount,
  realQuestionCount,
  generatedQuestionCount,
  topicClusterCount,
  dueTopicCount,
  warningCount,
}: {
  readonly projectSummary: StudyCompletionSummary;
  readonly sourceDocumentCount: number;
  readonly questionCandidateCount: number;
  readonly realQuestionCount: number;
  readonly generatedQuestionCount: number;
  readonly topicClusterCount: number;
  readonly dueTopicCount: number;
  readonly warningCount: number;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      <MetricTile
        label="Imported files"
        value={sourceDocumentCount}
        detail={`${questionCandidateCount} candidates`}
      />
      <MetricTile
        label="Real questions"
        value={realQuestionCount}
        detail={`${projectSummary.realQuestionsAttempted} attempted`}
      />
      <MetricTile
        label="Real score"
        value={`${projectSummary.weightedScorePercent}%`}
        detail="weighted by detected points"
      />
      <MetricTile label="Generated" value={generatedQuestionCount} detail="separate score pool" />
      <MetricTile label="Topic clusters" value={topicClusterCount} detail="analysis output" />
      <MetricTile label="Due topics" value={dueTopicCount} detail="real questions first" />
      <MetricTile label="Warnings" value={warningCount} detail="extraction review" />
    </section>
  );
}

function MetricTile({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-normal">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function PriorityOverview({
  clusters,
  classifications,
}: {
  readonly clusters: readonly StudyTopicCluster[];
  readonly classifications: readonly StudyQuestionClassification[];
}) {
  const orderedClusters = [...clusters].sort(
    (left, right) => left.priorityRank - right.priorityRank,
  );
  if (orderedClusters.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
        <ChartNoAxesColumnIncreasingIcon className="size-4" />
        Topic priority
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[64rem] w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/45 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Topic</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Recent</th>
              <th className="px-3 py-2 font-medium">Older</th>
              <th className="px-3 py-2 font-medium">Points</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
              <th className="px-3 py-2 font-medium">Subtypes</th>
            </tr>
          </thead>
          <tbody>
            {orderedClusters.map((cluster) => {
              const confidence = averageClassificationConfidence(classifications, cluster.id);
              const needsReview = confidence < 0.6 || cluster.id.includes("unclassified");
              return (
                <tr key={cluster.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3 align-top font-semibold">{cluster.priorityRank}</td>
                  <td className="max-w-72 px-3 py-3 align-top">
                    <div className="font-medium">{cluster.displayName}</div>
                    <div className="mt-1 leading-relaxed text-muted-foreground">
                      {cluster.priorityRationale}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Badge variant="outline">
                      {priorityLabelText(cluster.priorityLabel)}{" "}
                      {Math.round(cluster.priorityScore * 100)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 align-top">{cluster.recentQuestionParts}</td>
                  <td className="px-3 py-3 align-top">{cluster.olderQuestionAppearances}</td>
                  <td className="px-3 py-3 align-top">{cluster.weightedPoints}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      {needsReview ? (
                        <CircleAlertIcon className="size-3.5 text-warning-foreground" />
                      ) : null}
                      <span>{Math.round(confidence * 100)}%</span>
                    </div>
                  </td>
                  <td className="max-w-80 px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {cluster.subtypes.map((subtype) => (
                        <Badge key={subtype} size="sm" variant="outline">
                          {subtype}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TopicHeader({
  topicName,
  priorityScore,
  summary,
  realQuestionCount,
  attemptedRealQuestionCount,
  generatedQuestionCount,
  averageScore,
  weakSubtypes,
}: {
  readonly topicName: string;
  readonly priorityScore: number;
  readonly summary: string;
  readonly realQuestionCount: number;
  readonly attemptedRealQuestionCount: number;
  readonly generatedQuestionCount: number;
  readonly averageScore: number;
  readonly weakSubtypes: readonly string[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-normal">{topicName}</h1>
            <Badge variant="outline">Priority {Math.round(priorityScore * 100)}</Badge>
            {generatedQuestionCount > 0 ? (
              <Badge variant="warning">{generatedQuestionCount} generated</Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:min-w-80">
          <CompactStat label="Real" value={`${attemptedRealQuestionCount}/${realQuestionCount}`} />
          <CompactStat label="Score" value={`${averageScore}%`} />
          <CompactStat label="Weak" value={weakSubtypes.length} />
        </div>
      </div>
    </section>
  );
}

interface StudySubtypeGroup {
  readonly subtype: string;
  readonly questions: readonly StudyQuestion[];
}

function TopicModuleOverview({
  topicModule,
  subtypeGroups,
  attempts,
  activeQuestionId,
  onSelectQuestion,
}: {
  readonly topicModule: StudyTopicModule;
  readonly subtypeGroups: readonly StudySubtypeGroup[];
  readonly attempts: ReturnType<typeof useStudyFrameStore.getState>["attempts"];
  readonly activeQuestionId: string | null;
  readonly onSelectQuestion: (questionId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
        <ListTreeIcon className="size-4" />
        Topic module
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4 p-4">
          <section>
            <h2 className="text-xs font-medium text-muted-foreground">Theory summary</h2>
            <StudyMarkdown className="mt-2" content={topicModule.theorySummaryMarkdown} />
          </section>
          {topicModule.formulaSheetMarkdown.trim().length > 0 ? (
            <section>
              <h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <SigmaIcon className="size-3.5" />
                Formula reminders
              </h2>
              <StudyMarkdown className="mt-2" content={topicModule.formulaSheetMarkdown} />
            </section>
          ) : null}
        </div>
        <div className="border-t border-border p-3 lg:border-t-0 lg:border-l">
          <div className="px-1 text-xs font-medium text-muted-foreground">Real-question queue</div>
          <div className="mt-2 space-y-3">
            {subtypeGroups.map((group) => (
              <section key={group.subtype}>
                <div className="flex items-center justify-between gap-2 px-1 text-xs">
                  <span className="truncate font-medium">{group.subtype}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {
                      group.questions.filter((question) =>
                        isQuestionAttempted(attempts, question.id),
                      ).length
                    }
                    /{group.questions.length}
                  </span>
                </div>
                <div className="mt-1 grid gap-1">
                  {group.questions.map((question) => {
                    const attempted = isQuestionAttempted(attempts, question.id);
                    const active = question.id === activeQuestionId;
                    return (
                      <button
                        key={question.id}
                        type="button"
                        className={cn(
                          "flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                        )}
                        onClick={() => onSelectQuestion(question.id)}
                      >
                        <span className="truncate">{question.sourceQuizLabel}</span>
                        {attempted ? (
                          <CheckCircle2Icon className="size-3.5 shrink-0 text-success-foreground" />
                        ) : (
                          <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function averageClassificationConfidence(
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

function priorityLabelText(label: StudyTopicCluster["priorityLabel"]): string {
  return label.replace("_", " ");
}

function CompactStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}) {
  return (
    <div className="rounded-md border border-border bg-background/55 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function getSubtypeGroups(
  dataset: Pick<StudyDataset, "questionTopics">,
  questions: readonly StudyQuestion[],
): StudySubtypeGroup[] {
  const groups = new Map<string, StudyQuestion[]>();
  for (const question of questions) {
    const subtype = getQuestionTopic(dataset, question.id)?.subtype ?? "Unclassified";
    const group = groups.get(subtype) ?? [];
    group.push(question);
    groups.set(subtype, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([subtype, groupedQuestions]) => ({ subtype, questions: groupedQuestions }));
}

function QuestionPracticePanel({
  question,
  subtype,
  supportConfidence,
  answerDraft,
  latestHint,
  latestFeedback,
  solutionVisible,
  solutionSteps,
  commonMistakes,
  bestAttempt,
  attempts,
  answerInputType,
  onAnswerDraftChange,
  onHint,
  onCheckDirection,
  onSubmit,
  onRevealSolution,
  onNext,
}: {
  readonly question: StudyQuestion;
  readonly subtype: string;
  readonly supportConfidence: number;
  readonly answerDraft: string;
  readonly latestHint: string | undefined;
  readonly latestFeedback:
    | ReturnType<typeof useStudyFrameStore.getState>["latestFeedbackByQuestionId"][string]
    | undefined;
  readonly solutionVisible: boolean;
  readonly solutionSteps: readonly string[];
  readonly commonMistakes: readonly string[];
  readonly bestAttempt: ReturnType<typeof getBestAttempt>;
  readonly attempts: readonly StudyAttempt[];
  readonly answerInputType: StudyAnswerInputType;
  readonly onAnswerDraftChange: (answer: string) => void;
  readonly onHint: () => void;
  readonly onCheckDirection: () => void;
  readonly onSubmit: () => void;
  readonly onRevealSolution: () => void;
  readonly onNext: () => void;
}) {
  return (
    <div className="flex min-h-[34rem] flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={question.isRealQuestion ? "success" : "warning"}>
            {question.isRealQuestion ? "Real question" : "Generated"}
          </Badge>
          <Badge variant="outline">{subtype}</Badge>
          <Badge variant="outline">{question.pointValue} pts</Badge>
          <Badge variant="outline">{Math.round(supportConfidence * 100)}% support</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{question.sourceQuizLabel}</span>
          {question.sourceYear ? <span>{question.sourceYear}</span> : null}
          <span>{question.sourceAnchor}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <section>
          <h2 className="text-sm font-semibold">Question</h2>
          <StudyMarkdown className="mt-2" content={question.rawPrompt} />
        </section>

        <section className="flex flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Answer</h2>
            <div className="flex items-center gap-2">
              {answerInputType !== "free_text" ? (
                <Badge variant="outline">{answerInputType.replace("_", " ")}</Badge>
              ) : null}
              {bestAttempt ? (
                <Badge variant={bestAttempt.scorePercent >= 100 ? "success" : "outline"}>
                  Best {bestAttempt.scorePercent}%
                </Badge>
              ) : null}
            </div>
          </div>
          {answerInputType === "numeric" ? (
            <Input
              className="h-10"
              inputMode="decimal"
              placeholder="Enter a numeric answer"
              value={answerDraft}
              onChange={(event) => onAnswerDraftChange(event.target.value)}
            />
          ) : (
            <Textarea
              className="min-h-44 flex-1"
              placeholder="Work the real question here..."
              value={answerDraft}
              onChange={(event) => onAnswerDraftChange(event.target.value)}
            />
          )}
        </section>

        {latestHint ? (
          <FeedbackBlock icon={<LightbulbIcon className="size-4" />} title="Hint" tone="hint">
            {latestHint}
          </FeedbackBlock>
        ) : null}

        {latestFeedback ? (
          <FeedbackBlock
            icon={
              latestFeedback.status === "correct" ? (
                <CheckCircle2Icon className="size-4" />
              ) : (
                <CompassIcon className="size-4" />
              )
            }
            title={latestFeedback.tone === "direction" ? "Direction check" : "Feedback"}
            tone={latestFeedback.status}
          >
            <div>{latestFeedback.feedback}</div>
            <div className="mt-1 text-xs text-muted-foreground">{latestFeedback.nextStep}</div>
            <div className="mt-2 text-xs font-medium text-muted-foreground">
              {feedbackModeLabel(latestFeedback.gradingMode)}
            </div>
          </FeedbackBlock>
        ) : null}

        {solutionVisible ? (
          <SolutionBlock solutionSteps={solutionSteps} commonMistakes={commonMistakes} />
        ) : null}

        <AttemptHistory attempts={attempts} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/45 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onHint}>
            <LightbulbIcon className="size-4" />
            Hint
          </Button>
          <Button size="sm" variant="outline" onClick={onCheckDirection}>
            <CompassIcon className="size-4" />
            Check direction
          </Button>
          <Button size="sm" onClick={onSubmit}>
            <BadgeCheckIcon className="size-4" />
            Submit
          </Button>
          <Button size="sm" variant="outline" onClick={onRevealSolution}>
            <EyeIcon className="size-4" />
            Reveal solution
          </Button>
        </div>
        <Button size="sm" variant="ghost" onClick={onNext}>
          Next
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function FeedbackBlock({
  icon,
  title,
  tone,
  children,
}: {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly tone: "hint" | "correct" | "partially_correct" | "incorrect" | "revealed";
  readonly children: React.ReactNode;
}) {
  const toneClass =
    tone === "correct"
      ? "border-success/20 bg-success/8 text-success-foreground"
      : tone === "incorrect" || tone === "revealed"
        ? "border-destructive/20 bg-destructive/8 text-destructive-foreground"
        : tone === "partially_correct"
          ? "border-warning/20 bg-warning/8 text-warning-foreground"
          : "border-info/20 bg-info/8 text-info-foreground";

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", toneClass)}>
      <div className="mb-1 flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function SolutionBlock({
  solutionSteps,
  commonMistakes,
}: {
  readonly solutionSteps: readonly string[];
  readonly commonMistakes: readonly string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-background/65 px-3 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <NotebookTabsIcon className="size-4" />
        Solution
      </div>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
        {solutionSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {commonMistakes.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-muted-foreground">Common mistakes</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {commonMistakes.map((mistake) => (
              <li key={mistake}>{mistake}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AttemptHistory({ attempts }: { readonly attempts: readonly StudyAttempt[] }) {
  if (attempts.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-background/65 px-3 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <HistoryIcon className="size-4" />
        Attempt history
      </div>
      <div className="mt-2 divide-y divide-border">
        {attempts.toReversed().map((attempt) => (
          <div
            key={attempt.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs"
          >
            <Badge variant={attempt.scorePercent >= 100 ? "success" : "outline"}>
              {attempt.status.replace("_", " ")}
            </Badge>
            <span className="font-medium">
              {attempt.score}/{attempt.maxScore} pts
            </span>
            <span className="text-muted-foreground">{attempt.scorePercent}%</span>
            <span className="text-muted-foreground">{attempt.usedHintsCount} hints</span>
            <span className="text-muted-foreground">
              {feedbackModeLabel(attempt.feedback.gradingMode)}
            </span>
            <span className="ml-auto text-muted-foreground">
              {new Date(attempt.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceContextPanel({
  question,
  documentTitle,
  supportSummary,
  expectedAnswer,
  extractionWarnings,
  sourceAssets,
  realQuestionsRemaining,
  notPerfectCount,
  generationEnabled,
  onGenerateSimilar,
  onExportPriority,
  onExportSummary,
  onExportFinal,
  onExportTopic,
  onExportReviewMaterial,
  onExportMistakes,
}: {
  readonly question: StudyQuestion | null;
  readonly documentTitle: string | null;
  readonly supportSummary: string | null;
  readonly expectedAnswer: readonly string[];
  readonly extractionWarnings: readonly string[];
  readonly sourceAssets: readonly StudySourceAsset[];
  readonly realQuestionsRemaining: number;
  readonly notPerfectCount: number;
  readonly generationEnabled: boolean;
  readonly onGenerateSimilar: () => void;
  readonly onExportPriority: () => void;
  readonly onExportSummary: () => void;
  readonly onExportFinal: () => void;
  readonly onExportTopic: (() => void) | null;
  readonly onExportReviewMaterial: (() => void) | null;
  readonly onExportMistakes: (() => void) | null;
}) {
  return (
    <div className="flex h-full min-h-[34rem] flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileTextIcon className="size-4" />
          Source context
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 text-sm">
        {question ? (
          <>
            <ContextRow label="Document" value={documentTitle ?? question.documentId} />
            <ContextRow label="Anchor" value={question.sourceAnchor} />
            <ContextRow
              label="Extraction"
              value={`${Math.round(question.extractionConfidence * 100)}% confidence`}
            />
            {supportSummary ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Question support</div>
                <p className="mt-1 leading-relaxed">{supportSummary}</p>
              </div>
            ) : null}
            {expectedAnswer.length > 0 ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Expected answer markers
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {expectedAnswer.map((answer) => (
                    <Badge key={answer} variant="outline">
                      {answer}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {sourceAssets.length > 0 ? <SourceAssetList assets={sourceAssets} /> : null}
          </>
        ) : (
          <div className="text-muted-foreground">Select a topic question.</div>
        )}

        <div className="mt-auto rounded-lg border border-border bg-background/65 p-3">
          <div className="grid grid-cols-2 gap-2">
            <CompactStat label="Unattempted" value={realQuestionsRemaining} />
            <CompactStat label="Not 100%" value={notPerfectCount} />
          </div>
          <Button
            className="mt-3 w-full justify-start"
            size="sm"
            variant="outline"
            disabled={!generationEnabled}
            onClick={onGenerateSimilar}
          >
            <SparklesIcon className="size-4" />
            Generate similar questions
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-background/65 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileDownIcon className="size-3.5" />
            Markdown exports
          </div>
          <div className="grid gap-2">
            <Button
              className="justify-start"
              size="sm"
              variant="outline"
              onClick={onExportPriority}
            >
              Topic priority
            </Button>
            <Button className="justify-start" size="sm" variant="outline" onClick={onExportSummary}>
              Score summary
            </Button>
            <Button className="justify-start" size="sm" variant="outline" onClick={onExportFinal}>
              Final report
            </Button>
            <Button
              className="justify-start"
              size="sm"
              variant="outline"
              disabled={!onExportTopic}
              onClick={onExportTopic ?? undefined}
            >
              Topic thread
            </Button>
            <Button
              className="justify-start"
              size="sm"
              variant="outline"
              disabled={!onExportReviewMaterial}
              onClick={onExportReviewMaterial ?? undefined}
            >
              Review material
            </Button>
            <Button
              className="justify-start"
              size="sm"
              variant="outline"
              disabled={!onExportMistakes}
              onClick={onExportMistakes ?? undefined}
            >
              Mistakes review
            </Button>
          </div>
        </div>

        {extractionWarnings.length > 0 ? (
          <div className="rounded-lg border border-warning/20 bg-warning/8 px-3 py-2 text-xs text-warning-foreground">
            {extractionWarnings[0]}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SourceAssetList({ assets }: { readonly assets: readonly StudySourceAsset[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ImageIcon className="size-3.5" />
        Linked source assets
      </div>
      <div className="mt-2 space-y-2">
        {assets.map((asset) => {
          const previewUri = sourceAssetPreviewUri(asset);
          return (
            <section key={asset.id} className="rounded-md border border-border bg-muted/35 p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge size="sm" variant="outline">
                  {asset.kind.replace("_", " ")}
                </Badge>
                <span className="break-all text-muted-foreground">{asset.sourceAnchor}</span>
              </div>
              {previewUri ? (
                <img
                  className="mt-2 max-h-56 w-full rounded-md border border-border object-contain"
                  src={previewUri}
                  alt={asset.sourceAnchor}
                />
              ) : null}
              {asset.contentText ? (
                <StudyMarkdown
                  className="mt-2 max-h-56 overflow-auto text-xs"
                  content={asset.contentText}
                />
              ) : null}
              {asset.localUri ? (
                <div className="mt-2 break-all text-xs text-muted-foreground">{asset.localUri}</div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function sourceAssetPreviewUri(asset: StudySourceAsset): string | null {
  if (asset.kind !== "image" || !asset.localUri) return null;
  return /^(?:data:|https?:\/\/|file:\/\/)/.test(asset.localUri) ? asset.localUri : null;
}

function feedbackModeLabel(mode: "ai" | "local_fallback" | undefined): string {
  return mode === "ai" ? "AI feedback" : "Local fallback";
}

function ContextRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 break-words">{value}</div>
    </div>
  );
}

function ReviewSolutionsPanel({
  questions,
  attempts,
  getSupport,
}: {
  readonly questions: readonly StudyQuestion[];
  readonly attempts: ReturnType<typeof useStudyFrameStore.getState>["attempts"];
  readonly getSupport: (questionId: string) => ReturnType<typeof getQuestionSupport>;
}) {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <BookMarkedIcon className="size-4" />
        <h2 className="text-sm font-semibold">Solution review</h2>
      </div>
      <div className="space-y-3">
        {questions.map((question) => {
          const support = getSupport(question.id);
          const bestAttempt = getBestAttempt(attempts, question.id);
          return (
            <section
              key={question.id}
              className="rounded-lg border border-border bg-background/55 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={question.isRealQuestion ? "success" : "warning"}>
                  {question.isRealQuestion ? "Real" : "Generated"}
                </Badge>
                <span className="text-sm font-medium">{question.sourceQuizLabel}</span>
                {bestAttempt ? <Badge variant="outline">{bestAttempt.scorePercent}%</Badge> : null}
              </div>
              <StudyMarkdown className="mt-2" content={question.rawPrompt} />
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {(support?.solutionSteps ?? []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function EmptyPracticeState({ topicExhausted }: { readonly topicExhausted: boolean }) {
  return (
    <div className="flex min-h-[34rem] items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <ListRestartIcon className="mx-auto size-8 text-muted-foreground" />
        <div className="mt-3 text-sm font-medium">
          {topicExhausted ? "All real questions are complete." : "No question selected."}
        </div>
      </div>
    </div>
  );
}

function ExhaustionDialog({
  summary,
  open,
  onOpenChange,
  onRepeatAll,
  onRepeatNotPerfect,
  onGenerateSimilar,
  onReviewSolutions,
}: {
  readonly summary: StudyCompletionSummary | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRepeatAll: () => void;
  readonly onRepeatNotPerfect: () => void;
  readonly onGenerateSimilar: () => void;
  readonly onReviewSolutions: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>You finished all real questions.</DialogTitle>
          <DialogDescription>
            Real-question performance stays separate from generated practice.
          </DialogDescription>
        </DialogHeader>
        {summary ? (
          <DialogPanel>
            <div className="grid gap-2 sm:grid-cols-4">
              <CompactStat label="Weighted" value={`${summary.weightedScorePercent}%`} />
              <CompactStat label="Unweighted" value={`${summary.unweightedScorePercent}%`} />
              <CompactStat label="100%" value={summary.questions100Percent} />
              <CompactStat label="Revealed" value={summary.questionsRevealed} />
            </div>
            {summary.weakSubtypes.length > 0 ? (
              <div className="mt-4">
                <div className="text-xs font-medium text-muted-foreground">Weak subtypes</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {summary.weakSubtypes.map((subtype) => (
                    <Badge key={subtype} variant="warning">
                      {subtype}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </DialogPanel>
        ) : null}
        <DialogFooter className="flex-col sm:flex-col">
          <div className="grid w-full gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={onRepeatAll}>
              <RotateCcwIcon className="size-4" />
              Repeat all real questions
            </Button>
            <Button variant="outline" onClick={onRepeatNotPerfect}>
              <ListRestartIcon className="size-4" />
              Repeat only not-100%
            </Button>
            <Button onClick={onGenerateSimilar}>
              <SparklesIcon className="size-4" />
              Generate similar questions
            </Button>
            <Button variant="outline" onClick={onReviewSolutions}>
              <BookMarkedIcon className="size-4" />
              Review solutions only
            </Button>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
