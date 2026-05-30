import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BookMarkedIcon,
  CheckCircle2Icon,
  CompassIcon,
  EyeIcon,
  FileDownIcon,
  FileTextIcon,
  LightbulbIcon,
  ListRestartIcon,
  NotebookTabsIcon,
  RotateCcwIcon,
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
import { Textarea } from "~/components/ui/textarea";
import {
  exportMistakesReview,
  exportScoreSummary,
  exportTopicPriorityReport,
  exportTopicThread,
} from "~/study/studyExport";
import {
  createCompletionSummary,
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
import { installStudyFrameServerSync } from "~/study/studyServerSync";
import type { StudyCompletionSummary, StudyQuestion } from "~/study/studyTypes";
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
  const topicQuestions = topicThread ? getQuestionsForTopicThread(dataset, topicThread.id) : [];
  const realQuestions = topicQuestions.filter((question) => question.isRealQuestion);
  const generatedQuestions = topicQuestions.filter((question) => !question.isRealQuestion);
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
  const exportName = (project?.name ?? "studyframe").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground md:h-dvh">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <StudyHeader projectName={project?.name ?? APP_DISPLAY_NAME} />
        <ScrollArea className="flex-1">
          <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6">
            <ProjectDashboard
              projectSummary={projectSummary}
              realQuestionCount={
                dataset.questions.filter((question) => question.isRealQuestion).length
              }
              generatedQuestionCount={
                dataset.questions.filter((question) => !question.isRealQuestion).length
              }
              dueTopicCount={
                dataset.topicThreads.filter(
                  (thread) => getUnattemptedRealQuestions(dataset, attempts, thread.id).length > 0,
                ).length
              }
              warningCount={project?.extractionWarnings.length ?? 0}
            />

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
                    solutionOpen={solutionOpen}
                    solutionSteps={activeSupport?.solutionSteps ?? []}
                    commonMistakes={activeSupport?.commonMistakes ?? []}
                    bestAttempt={getBestAttempt(attempts, activeQuestion.id)}
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
                  supportSummary={activeSupport?.summaryContext ?? null}
                  expectedAnswer={activeSupport?.expectedAnswer ?? []}
                  extractionWarnings={project?.extractionWarnings ?? []}
                  realQuestionsRemaining={unattemptedRealQuestions.length}
                  notPerfectCount={notPerfectRealQuestions.length}
                  generationEnabled={topicExhausted}
                  onGenerateSimilar={generateSimilarQuestions}
                  onExportPriority={() =>
                    downloadMarkdown(
                      `${exportName}-topic-priority.md`,
                      exportTopicPriorityReport(dataset),
                    )
                  }
                  onExportSummary={() =>
                    downloadMarkdown(
                      `${exportName}-score-summary.md`,
                      exportScoreSummary({
                        dataset,
                        attempts,
                        projectId: selectedProjectId,
                        topicThreadId: topicThread?.id ?? null,
                      }),
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
                  onExportMistakes={
                    topicThread
                      ? () =>
                          downloadMarkdown(
                            `${exportName}-${topicThread.id}-mistakes.md`,
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
  realQuestionCount,
  generatedQuestionCount,
  dueTopicCount,
  warningCount,
}: {
  readonly projectSummary: StudyCompletionSummary;
  readonly realQuestionCount: number;
  readonly generatedQuestionCount: number;
  readonly dueTopicCount: number;
  readonly warningCount: number;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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

function QuestionPracticePanel({
  question,
  subtype,
  supportConfidence,
  answerDraft,
  latestHint,
  latestFeedback,
  solutionOpen,
  solutionSteps,
  commonMistakes,
  bestAttempt,
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
  readonly solutionOpen: boolean;
  readonly solutionSteps: readonly string[];
  readonly commonMistakes: readonly string[];
  readonly bestAttempt: ReturnType<typeof getBestAttempt>;
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
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{question.rawPrompt}</p>
        </section>

        <section className="flex flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Answer</h2>
            {bestAttempt ? (
              <Badge variant={bestAttempt.scorePercent >= 100 ? "success" : "outline"}>
                Best {bestAttempt.scorePercent}%
              </Badge>
            ) : null}
          </div>
          <Textarea
            className="min-h-44 flex-1"
            placeholder="Work the real question here..."
            value={answerDraft}
            onChange={(event) => onAnswerDraftChange(event.target.value)}
          />
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
          </FeedbackBlock>
        ) : null}

        {solutionOpen ? (
          <SolutionBlock solutionSteps={solutionSteps} commonMistakes={commonMistakes} />
        ) : null}
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

function SourceContextPanel({
  question,
  documentTitle,
  supportSummary,
  expectedAnswer,
  extractionWarnings,
  realQuestionsRemaining,
  notPerfectCount,
  generationEnabled,
  onGenerateSimilar,
  onExportPriority,
  onExportSummary,
  onExportTopic,
  onExportMistakes,
}: {
  readonly question: StudyQuestion | null;
  readonly documentTitle: string | null;
  readonly supportSummary: string | null;
  readonly expectedAnswer: readonly string[];
  readonly extractionWarnings: readonly string[];
  readonly realQuestionsRemaining: number;
  readonly notPerfectCount: number;
  readonly generationEnabled: boolean;
  readonly onGenerateSimilar: () => void;
  readonly onExportPriority: () => void;
  readonly onExportSummary: () => void;
  readonly onExportTopic: (() => void) | null;
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
              <p className="mt-2 text-sm leading-relaxed">{question.rawPrompt}</p>
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
