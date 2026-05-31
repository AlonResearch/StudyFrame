import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BookMarkedIcon,
  ChartNoAxesColumnIncreasingIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CompassIcon,
  EllipsisIcon,
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
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RightPanelSheet } from "~/components/RightPanelSheet";
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
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";
import { StudyAnswerInput } from "~/components/study/StudyAnswerInput";
import { StudyMarkdown } from "~/components/study/StudyMarkdown";
import {
  exportFinalReport,
  exportScoreSummary,
  exportTopicPriorityReport,
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
  StudyQuestionCandidate,
  StudySourceAsset,
  StudySourceDocument,
  StudyTopicCluster,
  StudyTopicModule,
} from "~/study/studyTypes";
import { APP_DISPLAY_NAME } from "~/branding";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";

type StudyExtraInfoSection =
  | "course-details"
  | "reports"
  | "topic-menu"
  | "queue"
  | "source-context";

export function StudyWorkspace() {
  const [extraInfo, setExtraInfo] = useState<{
    readonly open: boolean;
    readonly section: StudyExtraInfoSection;
  }>({ open: false, section: "course-details" });

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
  const showExhaustionSummary = useStudyFrameStore((state) => state.showExhaustionSummary);
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
      ? (dataset.questionCandidates.find(
          (candidate) =>
            candidate.documentId === activeQuestion.documentId &&
            candidate.sourceAnchor === activeQuestion.sourceAnchor,
        ) ?? null)
      : null;
  const activePracticeItem =
    dataset.practiceItems?.find(
      (item) =>
        item.id === `practice-${activeQuestion?.id}` ||
        item.sourceQuestionCandidateId === activeCandidate?.id,
    ) ?? null;
  const activeSourceAssets = activeCandidate
    ? (dataset.sourceAssets ?? []).filter((asset) => activeCandidate.assetIds.includes(asset.id))
    : [];
  const activeSourceDocument =
    (dataset.sourceDocuments ?? []).find(
      (document) => document.id === activeQuestion?.documentId,
    ) ?? null;
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
  const showTopicWorkspace = topicThread !== null;
  const openExtraInfo = (section: StudyExtraInfoSection) => {
    setExtraInfo({ open: true, section });
  };
  const closeExtraInfo = () => {
    setExtraInfo((current) => ({ ...current, open: false }));
  };

  useEffect(() => {
    setExtraInfo({
      open: false,
      section: topicThread ? "topic-menu" : "course-details",
    });
  }, [selectedProjectId, topicThread]);

  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground md:h-dvh">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <StudyHeader
          projectName={project?.name ?? APP_DISPLAY_NAME}
          topicSelected={showTopicWorkspace}
          onOpenExtraInfo={openExtraInfo}
        />
        <ScrollArea className="flex-1">
          <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6">
            {!showTopicWorkspace ? (
              <>
                <LearningTracker
                  projectSummary={projectSummary}
                  realQuestionCount={
                    dataset.questions.filter((question) => question.isRealQuestion).length
                  }
                  dueTopicCount={
                    dataset.topicThreads.filter(
                      (thread) =>
                        thread.projectId === selectedProjectId &&
                        getUnattemptedRealQuestions(dataset, attempts, thread.id).length > 0,
                    ).length
                  }
                />

                {dataset.topicClusters && dataset.topicClusters.length > 0 ? (
                  <PriorityOverview
                    clusters={dataset.topicClusters.filter(
                      (cluster) => cluster.projectId === selectedProjectId,
                    )}
                    classifications={dataset.questionClassifications ?? []}
                  />
                ) : null}
              </>
            ) : (
              <TopicWorkspace
                activeQuestion={activeQuestion}
                activePracticeItem={activePracticeItem}
                activeSupport={activeSupport}
                activeTopic={activeTopic}
                answerDraft={answerDraft}
                attempts={attempts}
                generatedQuestionCount={generatedQuestions.length}
                latestFeedback={latestFeedback}
                latestHint={latestHint}
                questionAttempts={
                  activeQuestion ? getAttemptsForQuestion(attempts, activeQuestion.id) : []
                }
                realQuestionCount={realQuestions.length}
                realQuestionsRemaining={unattemptedRealQuestions.length}
                answerRevealed={solutionOpen}
                solutionSteps={
                  supportVisibility.solutionVisible ? (activeSupport?.solutionSteps ?? []) : []
                }
                commonMistakes={
                  supportVisibility.commonMistakesVisible
                    ? (activeSupport?.commonMistakes ?? [])
                    : []
                }
                solutionVisible={supportVisibility.solutionVisible}
                topicExhausted={topicExhausted}
                topicName={topicThread.displayName}
                topicPriorityScore={topicThread.priorityScore}
                topicSummaryText={topicThread.summary}
                topicModule={topicModule}
                topicWeightedScore={topicSummary?.weightedScorePercent ?? 0}
                weakSubtypes={topicSummary?.weakSubtypes ?? []}
                onOpenExtraInfo={openExtraInfo}
                reviewMode={reviewModeTopicThreadId === topicThread.id}
                reviewQuestions={
                  notPerfectRealQuestions.length > 0 ? notPerfectRealQuestions : realQuestions
                }
                onAnswerDraftChange={(answer) => {
                  if (activeQuestion) setAnswerDraft(activeQuestion.id, answer);
                }}
                onCheckDirection={() => {
                  if (activeQuestion) checkDirection(activeQuestion.id);
                }}
                onHint={() => {
                  if (activeQuestion) requestHint(activeQuestion.id);
                }}
                onNext={moveToNextQuestion}
                onViewResults={showExhaustionSummary}
                onRevealSolution={() => {
                  if (activeQuestion) revealSolution(activeQuestion.id);
                }}
                onSubmit={() => {
                  if (activeQuestion) submitAnswer(activeQuestion.id);
                }}
                getSupport={(questionId) => getQuestionSupport(dataset, questionId)}
              />
            )}
          </main>
        </ScrollArea>
      </div>

      <RightPanelSheet open={extraInfo.open} onClose={closeExtraInfo}>
        <StudyExtraInfoDrawer
          section={extraInfo.section}
          topicSelected={showTopicWorkspace}
          onClose={closeExtraInfo}
          onSelectSection={openExtraInfo}
        >
          {showTopicWorkspace ? (
            <TopicExtraInfoSection
              section={extraInfo.section}
              activeQuestionId={activeQuestionId}
              attempts={attempts}
              candidate={activeCandidate}
              documentTitle={
                activeQuestion
                  ? (dataset.documents.find((document) => document.id === activeQuestion.documentId)
                      ?.title ?? null)
                  : null
              }
              sourceDocument={activeSourceDocument}
              generationEnabled={topicExhausted}
              notPerfectCount={notPerfectRealQuestions.length}
              question={activeQuestion}
              realQuestionsRemaining={unattemptedRealQuestions.length}
              sourceAssets={activeSourceAssets}
              subtypeGroups={subtypeGroups}
              topic={activeTopic}
              supportSummary={sourceContextSupport.supportSummary}
              expectedAnswer={sourceContextSupport.expectedAnswer}
              supportConfidence={activeSupport?.supportConfidence ?? null}
              onGenerateSimilar={generateSimilarQuestions}
              onSelectQuestion={selectQuestion}
            />
          ) : (
            <CourseExtraInfoSection
              section={extraInfo.section}
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
                  (thread) =>
                    thread.projectId === selectedProjectId &&
                    getUnattemptedRealQuestions(dataset, attempts, thread.id).length > 0,
                ).length
              }
              warningCount={project?.extractionWarnings.length ?? 0}
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
                    topicThreadId: null,
                  }),
                )
              }
              onExportFinal={() =>
                downloadMarkdown(
                  `final_report_${exportName}.md`,
                  exportFinalReport({ dataset, attempts, projectId: selectedProjectId }),
                )
              }
            />
          )}
        </StudyExtraInfoDrawer>
      </RightPanelSheet>

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

function StudyHeader({
  projectName,
  topicSelected,
  onOpenExtraInfo,
}: {
  readonly projectName: string;
  readonly topicSelected: boolean;
  readonly onOpenExtraInfo: (section: StudyExtraInfoSection) => void;
}) {
  return (
    <header
      className={cn(
        "border-b border-border px-3 sm:px-5",
        isElectron
          ? "drag-region flex h-[52px] items-center wco:h-[env(titlebar-area-height)] wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]"
          : "py-2 sm:py-3",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="size-7 shrink-0 [-webkit-app-region:no-drag]" />
        <span className="truncate text-sm font-medium text-foreground md:text-muted-foreground/70">
          {projectName}
        </span>
      </div>
      {!topicSelected ? (
        <Menu>
          <MenuTrigger
            render={
              <Button
                className="size-8 shrink-0 [-webkit-app-region:no-drag]"
                size="icon"
                variant="ghost"
                aria-label="Extra information"
              />
            }
          >
            <EllipsisIcon className="size-4" />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={() => onOpenExtraInfo("course-details")}>Course details</MenuItem>
            <MenuItem onClick={() => onOpenExtraInfo("reports")}>Reports</MenuItem>
          </MenuPopup>
        </Menu>
      ) : null}
    </header>
  );
}

function StudyExtraInfoDrawer({
  section,
  topicSelected,
  onClose,
  onSelectSection,
  children,
}: {
  readonly section: StudyExtraInfoSection;
  readonly topicSelected: boolean;
  readonly onClose: () => void;
  readonly onSelectSection: (section: StudyExtraInfoSection) => void;
  readonly children: React.ReactNode;
}) {
  const sections: readonly { readonly id: StudyExtraInfoSection; readonly label: string }[] =
    topicSelected
      ? [
          { id: "queue", label: "Question queue" },
          { id: "source-context", label: "Question details" },
        ]
      : [
          { id: "course-details", label: "Course details" },
          { id: "reports", label: "Reports" },
        ];
  const title =
    sections.find((candidate) => candidate.id === section)?.label ??
    sections[0]?.label ??
    "Extra information";

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-semibold">{title}</span>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onClose}
          aria-label="Close extra information"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
      <div className="border-b border-border p-2">
        <div
          className={cn(
            "grid gap-1 rounded-md bg-muted/45 p-1",
            topicSelected ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {sections.map((candidate) => (
            <Button
              key={candidate.id}
              size="sm"
              variant={candidate.id === section ? "secondary" : "ghost"}
              onClick={() => onSelectSection(candidate.id)}
            >
              {candidate.label}
            </Button>
          ))}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>
    </div>
  );
}

function LearningTracker({
  projectSummary,
  realQuestionCount,
  dueTopicCount,
}: {
  readonly projectSummary: StudyCompletionSummary;
  readonly realQuestionCount: number;
  readonly dueTopicCount: number;
}) {
  const attemptedRatio =
    realQuestionCount === 0 ? 0 : projectSummary.realQuestionsAttempted / realQuestionCount;
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-normal">Learning tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectSummary.realQuestionsAttempted}/{realQuestionCount} real questions attempted
          </p>
          <ProgressBar value={attemptedRatio} className="mt-3 max-w-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[30rem]">
          <CompactStat label="Weighted" value={`${projectSummary.weightedScorePercent}%`} />
          <CompactStat label="Unweighted" value={`${projectSummary.unweightedScorePercent}%`} />
          <CompactStat label="100%" value={projectSummary.questions100Percent} />
          <CompactStat label="Due topics" value={dueTopicCount} />
        </div>
      </div>
    </section>
  );
}

interface CourseExtraInfoProps {
  readonly projectSummary: StudyCompletionSummary;
  readonly sourceDocumentCount: number;
  readonly questionCandidateCount: number;
  readonly realQuestionCount: number;
  readonly generatedQuestionCount: number;
  readonly topicClusterCount: number;
  readonly dueTopicCount: number;
  readonly warningCount: number;
  readonly onExportPriority: () => void;
  readonly onExportSummary: () => void;
  readonly onExportFinal: () => void;
}

function CourseExtraInfoSection({
  section,
  ...props
}: CourseExtraInfoProps & {
  readonly section: StudyExtraInfoSection;
}) {
  if (section === "reports") {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FileDownIcon className="size-4" />
          Markdown reports
        </div>
        <div className="grid gap-2">
          <Button
            className="justify-start"
            size="sm"
            variant="outline"
            onClick={props.onExportPriority}
          >
            Topic priority
          </Button>
          <Button
            className="justify-start"
            size="sm"
            variant="outline"
            onClick={props.onExportSummary}
          >
            Score summary
          </Button>
          <Button
            className="justify-start"
            size="sm"
            variant="outline"
            onClick={props.onExportFinal}
          >
            Final report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2">
      <MetricTile
        label="Imported files"
        value={props.sourceDocumentCount}
        detail={`${props.questionCandidateCount} candidates`}
      />
      <MetricTile
        label="Real questions"
        value={props.realQuestionCount}
        detail={`${props.projectSummary.realQuestionsAttempted} attempted`}
      />
      <MetricTile
        label="Generated"
        value={props.generatedQuestionCount}
        detail="separate score pool"
      />
      <MetricTile label="Topic clusters" value={props.topicClusterCount} detail="analysis output" />
      <MetricTile label="Due topics" value={props.dueTopicCount} detail="real questions first" />
      <MetricTile label="Warnings" value={props.warningCount} detail="extraction review" />
    </div>
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

function ProgressBar({
  value,
  className,
}: {
  readonly value: number;
  readonly className?: string;
}) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
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
  onOpenExtraInfo,
}: {
  readonly topicName: string;
  readonly priorityScore: number;
  readonly summary: string;
  readonly realQuestionCount: number;
  readonly attemptedRealQuestionCount: number;
  readonly generatedQuestionCount: number;
  readonly averageScore: number;
  readonly weakSubtypes: readonly string[];
  readonly onOpenExtraInfo: (section: StudyExtraInfoSection) => void;
}) {
  return (
    <header className="border-b border-border px-5 py-5 sm:px-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
        <div className="flex items-start gap-2">
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs lg:justify-end">
            <InlineStat
              label="Real questions"
              value={`${attemptedRealQuestionCount}/${realQuestionCount}`}
            />
            <InlineStat label="Score" value={`${averageScore}%`} />
            <InlineStat label="Weak areas" value={weakSubtypes.length} />
          </div>
          <Menu>
            <MenuTrigger
              render={<Button size="icon-xs" variant="ghost" aria-label="Question details" />}
            >
              <EllipsisIcon className="size-4" />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem onClick={() => onOpenExtraInfo("source-context")}>
                About this question
              </MenuItem>
              <MenuItem onClick={() => onOpenExtraInfo("queue")}>Question queue</MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </div>
    </header>
  );
}

interface StudySubtypeGroup {
  readonly subtype: string;
  readonly questions: readonly StudyQuestion[];
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

function TopicWorkspace({
  activeQuestion,
  activePracticeItem,
  activeSupport,
  activeTopic,
  answerRevealed,
  answerDraft,
  attempts,
  generatedQuestionCount,
  getSupport,
  latestFeedback,
  latestHint,
  questionAttempts,
  realQuestionCount,
  realQuestionsRemaining,
  reviewMode,
  reviewQuestions,
  solutionSteps,
  commonMistakes,
  solutionVisible,
  topicExhausted,
  topicName,
  topicPriorityScore,
  topicSummaryText,
  topicModule,
  topicWeightedScore,
  weakSubtypes,
  onOpenExtraInfo,
  onAnswerDraftChange,
  onCheckDirection,
  onHint,
  onNext,
  onViewResults,
  onRevealSolution,
  onSubmit,
}: {
  readonly activeQuestion: StudyQuestion | null;
  readonly activePracticeItem: {
    readonly answerInputType: StudyAnswerInputType;
    readonly sourceMetadataJson: unknown;
  } | null;
  readonly activeSupport: ReturnType<typeof getQuestionSupport>;
  readonly activeTopic: ReturnType<typeof getQuestionTopic>;
  readonly answerRevealed: boolean;
  readonly answerDraft: string;
  readonly attempts: readonly StudyAttempt[];
  readonly generatedQuestionCount: number;
  readonly getSupport: (questionId: string) => ReturnType<typeof getQuestionSupport>;
  readonly latestFeedback:
    | ReturnType<typeof useStudyFrameStore.getState>["latestFeedbackByQuestionId"][string]
    | undefined;
  readonly latestHint: string | undefined;
  readonly questionAttempts: readonly StudyAttempt[];
  readonly realQuestionCount: number;
  readonly realQuestionsRemaining: number;
  readonly reviewMode: boolean;
  readonly reviewQuestions: readonly StudyQuestion[];
  readonly solutionSteps: readonly string[];
  readonly commonMistakes: readonly string[];
  readonly solutionVisible: boolean;
  readonly topicExhausted: boolean;
  readonly topicName: string;
  readonly topicPriorityScore: number;
  readonly topicSummaryText: string;
  readonly topicModule: StudyTopicModule | null;
  readonly topicWeightedScore: number;
  readonly weakSubtypes: readonly string[];
  readonly onOpenExtraInfo: (section: StudyExtraInfoSection) => void;
  readonly onAnswerDraftChange: (answer: string) => void;
  readonly onCheckDirection: () => void;
  readonly onHint: () => void;
  readonly onNext: () => void;
  readonly onViewResults: () => void;
  readonly onRevealSolution: () => void;
  readonly onSubmit: () => void;
}) {
  const attemptedRealQuestionCount = realQuestionCount - realQuestionsRemaining;
  return (
    <section className="overflow-hidden border border-border bg-card text-card-foreground sm:rounded-lg">
      <TopicHeader
        topicName={topicName}
        priorityScore={topicPriorityScore}
        summary={topicSummaryText}
        realQuestionCount={realQuestionCount}
        attemptedRealQuestionCount={attemptedRealQuestionCount}
        generatedQuestionCount={generatedQuestionCount}
        averageScore={topicWeightedScore}
        weakSubtypes={weakSubtypes}
        onOpenExtraInfo={onOpenExtraInfo}
      />

      <TopicTheoryReview topicModule={topicModule} />

      {reviewMode ? (
        <ReviewSolutionsPanel
          questions={reviewQuestions}
          attempts={attempts}
          getSupport={getSupport}
        />
      ) : activeQuestion ? (
        <QuestionPracticePanel
          question={activeQuestion}
          subtype={activeTopic?.subtype ?? "Unclassified"}
          answerDraft={answerDraft}
          answerRevealed={answerRevealed}
          latestHint={latestHint}
          latestFeedback={latestFeedback}
          solutionVisible={solutionVisible}
          solutionSteps={solutionSteps}
          commonMistakes={commonMistakes}
          bestAttempt={getBestAttempt(attempts, activeQuestion.id)}
          attempts={questionAttempts}
          answerInputType={activePracticeItem?.answerInputType ?? "free_text"}
          sourceMetadataJson={activePracticeItem?.sourceMetadataJson ?? null}
          onAnswerDraftChange={onAnswerDraftChange}
          onHint={onHint}
          onCheckDirection={onCheckDirection}
          onSubmit={onSubmit}
          onRevealSolution={onRevealSolution}
          onNext={onNext}
          onViewResults={onViewResults}
          topicExhausted={topicExhausted}
        />
      ) : (
        <EmptyPracticeState topicExhausted={topicExhausted} />
      )}
    </section>
  );
}

function TopicExtraInfoSection({
  section,
  activeQuestionId,
  attempts,
  candidate,
  documentTitle,
  sourceDocument,
  expectedAnswer,
  generationEnabled,
  notPerfectCount,
  question,
  realQuestionsRemaining,
  sourceAssets,
  subtypeGroups,
  topic,
  supportSummary,
  supportConfidence,
  onGenerateSimilar,
  onSelectQuestion,
}: {
  readonly section: StudyExtraInfoSection;
  readonly activeQuestionId: string | null;
  readonly attempts: readonly StudyAttempt[];
  readonly candidate: StudyQuestionCandidate | null;
  readonly documentTitle: string | null;
  readonly sourceDocument: StudySourceDocument | null;
  readonly expectedAnswer: readonly string[];
  readonly generationEnabled: boolean;
  readonly notPerfectCount: number;
  readonly question: StudyQuestion | null;
  readonly realQuestionsRemaining: number;
  readonly sourceAssets: readonly StudySourceAsset[];
  readonly subtypeGroups: readonly StudySubtypeGroup[];
  readonly topic: ReturnType<typeof getQuestionTopic>;
  readonly supportSummary: string | null;
  readonly supportConfidence: number | null;
  readonly onGenerateSimilar: () => void;
  readonly onSelectQuestion: (questionId: string) => void;
}) {
  if (section === "source-context") {
    return (
      <SourceContextPanel
        question={question}
        candidate={candidate}
        documentTitle={documentTitle}
        sourceDocument={sourceDocument}
        topic={topic}
        supportSummary={supportSummary}
        supportConfidence={supportConfidence}
        expectedAnswer={expectedAnswer}
        sourceAssets={sourceAssets}
      />
    );
  }

  if (section === "queue") {
    return (
      <TopicQueuePanel
        activeQuestionId={activeQuestionId}
        attempts={attempts}
        generationEnabled={generationEnabled}
        notPerfectCount={notPerfectCount}
        realQuestionsRemaining={realQuestionsRemaining}
        subtypeGroups={subtypeGroups}
        onGenerateSimilar={onGenerateSimilar}
        onSelectQuestion={onSelectQuestion}
      />
    );
  }

  return null;
}

function TopicTheoryReview({ topicModule }: { readonly topicModule: StudyTopicModule | null }) {
  if (!topicModule) {
    return null;
  }
  const review = getTopicReviewSections(topicModule);
  const hasBriefExplanation = review.briefExplanationMarkdown.trim().length > 0;
  return (
    <section className="space-y-4 border-b border-border bg-muted/20 px-5 py-5 text-sm text-card-foreground sm:px-7">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Step 1
        </div>
        <h2 className="mt-1 text-base font-semibold">Brief explanation</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Quick theory, definitions, and formulas before the current question.
        </p>
      </div>
      {hasBriefExplanation ? (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">What this topic is about</h3>
          <StudyMarkdown className="mt-2" content={review.briefExplanationMarkdown} />
        </section>
      ) : null}
      {review.definitionsAndFormulasMarkdown.trim().length > 0 ? (
        <section>
          <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <SigmaIcon className="size-3.5" />
            Definitions and formulas
          </h3>
          <StudyMarkdown className="mt-2" content={review.definitionsAndFormulasMarkdown} />
        </section>
      ) : null}
      {review.recurringQuestionTypes.length > 0 ? (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">Recurring question types</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {review.recurringQuestionTypes.map((subtype) => (
              <Badge key={subtype} size="sm" variant="outline">
                {subtype}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
      {review.questionPatterns.length > 0 ? (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">
            How these questions usually work
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {review.questionPatterns.map((pattern) => (
              <li key={pattern}>{pattern}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {review.solveFlow.length > 0 ? (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">Solve flow</h3>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2">
            {review.solveFlow.map((step, index) => (
              <li
                className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs leading-relaxed"
                key={step}
              >
                <span className="mr-1 font-semibold text-foreground">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </section>
  );
}

function getTopicReviewSections(topicModule: StudyTopicModule) {
  return {
    briefExplanationMarkdown: topicModule.theorySummaryMarkdown,
    definitionsAndFormulasMarkdown: topicModule.formulaSheetMarkdown,
    recurringQuestionTypes: getTopicModuleSubtypes(topicModule.subtypeCoverageJson),
    questionPatterns: getTopicModuleStringArray(topicModule.subtypeCoverageJson, "questionPatterns"),
    solveFlow: getTopicModuleStringArray(topicModule.subtypeCoverageJson, "studyFlow"),
  };
}

function getTopicModuleSubtypes(subtypeCoverageJson: unknown): string[] {
  if (
    typeof subtypeCoverageJson !== "object" ||
    subtypeCoverageJson === null ||
    !("subtypes" in subtypeCoverageJson)
  ) {
    return [];
  }
  const subtypes = (subtypeCoverageJson as { readonly subtypes?: unknown }).subtypes;
  if (Array.isArray(subtypes)) {
    return subtypes.filter((subtype): subtype is string => typeof subtype === "string");
  }
  const ignoredKeys = new Set(["subtypes", "counts", "questionPatterns", "studyFlow"]);
  return Object.keys(subtypeCoverageJson).filter((key) => !ignoredKeys.has(key));
}

function getTopicModuleStringArray(subtypeCoverageJson: unknown, key: string): string[] {
  if (typeof subtypeCoverageJson !== "object" || subtypeCoverageJson === null) return [];
  const value = (subtypeCoverageJson as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function TopicQueuePanel({
  activeQuestionId,
  attempts,
  generationEnabled,
  notPerfectCount,
  realQuestionsRemaining,
  subtypeGroups,
  onGenerateSimilar,
  onSelectQuestion,
}: {
  readonly activeQuestionId: string | null;
  readonly attempts: readonly StudyAttempt[];
  readonly generationEnabled: boolean;
  readonly notPerfectCount: number;
  readonly realQuestionsRemaining: number;
  readonly subtypeGroups: readonly StudySubtypeGroup[];
  readonly onGenerateSimilar: () => void;
  readonly onSelectQuestion: (questionId: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 text-sm">
      <div className="rounded-lg border border-border bg-background/65 p-3">
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

      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ListTreeIcon className="size-3.5" />
          Real-question queue
        </div>
        <div className="mt-2 space-y-3">
          {subtypeGroups.map((group) => (
            <section key={group.subtype}>
              <div className="flex items-center justify-between gap-2 px-1 text-xs">
                <span className="truncate font-medium">{group.subtype}</span>
                <span className="shrink-0 text-muted-foreground">
                  {
                    group.questions.filter((question) => isQuestionAttempted(attempts, question.id))
                      .length
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

function InlineStat({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
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
  answerDraft,
  answerRevealed,
  latestHint,
  latestFeedback,
  solutionVisible,
  solutionSteps,
  commonMistakes,
  bestAttempt,
  attempts,
  answerInputType,
  sourceMetadataJson,
  onAnswerDraftChange,
  onHint,
  onCheckDirection,
  onSubmit,
  onRevealSolution,
  onNext,
  onViewResults,
  topicExhausted,
}: {
  readonly question: StudyQuestion;
  readonly subtype: string;
  readonly answerDraft: string;
  readonly answerRevealed: boolean;
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
  readonly sourceMetadataJson: unknown;
  readonly onAnswerDraftChange: (answer: string) => void;
  readonly onHint: () => void;
  readonly onCheckDirection: () => void;
  readonly onSubmit: () => void;
  readonly onRevealSolution: () => void;
  readonly onNext: () => void;
  readonly onViewResults: () => void;
  readonly topicExhausted: boolean;
}) {
  const progressiveHelpAction = latestHint
    ? {
        icon: <EyeIcon className="size-4" />,
        label: "Show answer",
        onClick: onRevealSolution,
      }
    : latestFeedback?.tone === "direction"
      ? {
          icon: <LightbulbIcon className="size-4" />,
          label: "Hint",
          onClick: onHint,
        }
      : {
          icon: <CompassIcon className="size-4" />,
          label: "Check direction",
          onClick: onCheckDirection,
        };
  const visibleAssistance =
    latestFeedback?.tone !== "direction" || !latestHint ? latestFeedback : undefined;
  const canMoveNext = answerRevealed || bestAttempt !== undefined;
  const resultsReady = question.isRealQuestion && topicExhausted && canMoveNext;

  return (
    <div className="flex min-h-[34rem] flex-col">
      <div className="border-b border-border px-5 py-5 sm:px-7">
        <WorkflowProgress
          answerDraft={answerDraft}
          answerRevealed={answerRevealed}
          hasDirectionCheck={latestFeedback?.tone === "direction" || latestHint !== undefined}
          hasResult={bestAttempt !== undefined}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={question.isRealQuestion ? "success" : "warning"}>
            {question.isRealQuestion ? "Real question" : "Generated"}
          </Badge>
          <Badge variant="outline">{subtype}</Badge>
          <Badge variant="outline">{question.pointValue} pts</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{question.sourceQuizLabel}</span>
          {question.sourceYear ? <span>{question.sourceYear}</span> : null}
          <span>{question.sourceAnchor}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 py-5 sm:px-7">
        <section>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Step 2
          </div>
          <h2 className="mt-1 text-base font-semibold">Question</h2>
          <StudyMarkdown className="mt-3 text-[15px]" content={question.rawPrompt} />
        </section>

        {!answerRevealed ? (
          <section className="flex flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Your answer</h2>
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
            <StudyAnswerInput
              answerDraft={answerDraft}
              answerInputType={answerInputType}
              sourceMetadataJson={sourceMetadataJson}
              onAnswerDraftChange={onAnswerDraftChange}
            />
          </section>
        ) : null}

        {latestHint && !visibleAssistance ? (
          <FeedbackBlock icon={<LightbulbIcon className="size-4" />} title="Hint" tone="hint">
            {latestHint}
          </FeedbackBlock>
        ) : null}

        {visibleAssistance ? (
          <FeedbackBlock
            icon={
              visibleAssistance.status === "correct" ? (
                <CheckCircle2Icon className="size-4" />
              ) : (
                <CompassIcon className="size-4" />
              )
            }
            title={visibleAssistance.tone === "direction" ? "Direction check" : "Feedback"}
            tone={visibleAssistance.status}
          >
            <div>{visibleAssistance.feedback}</div>
            <div className="mt-1 text-xs text-muted-foreground">{visibleAssistance.nextStep}</div>
            <div className="mt-2 text-xs font-medium text-muted-foreground">
              {feedbackModeLabel(visibleAssistance.gradingMode)}
            </div>
          </FeedbackBlock>
        ) : null}

        {solutionVisible ? (
          <AnswerReviewBlock
            solutionSteps={solutionSteps}
            commonMistakes={commonMistakes}
          />
        ) : null}

        <AttemptHistory attempts={attempts} />
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 px-5 py-3 backdrop-blur sm:px-7">
        <div className="flex flex-wrap gap-2">
          {!answerRevealed ? (
            <>
              <Button size="sm" variant="outline" onClick={progressiveHelpAction.onClick}>
                {progressiveHelpAction.icon}
                {progressiveHelpAction.label}
              </Button>
              <Button size="sm" onClick={onSubmit}>
                <BadgeCheckIcon className="size-4" />
                Submit
              </Button>
            </>
          ) : null}
        </div>
        {canMoveNext ? (
          <Button
            size="sm"
            variant={resultsReady ? "default" : "ghost"}
            onClick={resultsReady ? onViewResults : onNext}
          >
            {resultsReady ? "View results" : "Next question"}
            <ArrowRightIcon className="size-4" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Submit an answer or use the guided help to continue.
          </span>
        )}
      </div>
    </div>
  );
}

function WorkflowProgress({
  answerDraft,
  answerRevealed,
  hasDirectionCheck,
  hasResult,
}: {
  readonly answerDraft: string;
  readonly answerRevealed: boolean;
  readonly hasDirectionCheck: boolean;
  readonly hasResult: boolean;
}) {
  const currentStep = hasResult || answerRevealed ? 3 : hasDirectionCheck ? 2 : answerDraft ? 1 : 0;
  const steps = ["Review", "Answer", "Check", "Result"];
  return (
    <ol className="mb-5 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
      {steps.map((step, index) => (
        <li className="flex min-w-0 items-center gap-2" key={step}>
          {index > 0 ? <span className="h-px w-4 bg-border sm:w-8" /> : null}
          <span className={cn(index <= currentStep && "text-foreground")}>
            <span className="mr-1 text-muted-foreground">{index + 1}.</span>
            {step}
          </span>
        </li>
      ))}
    </ol>
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

function AnswerReviewBlock({
  solutionSteps,
  commonMistakes,
}: {
  readonly solutionSteps: readonly string[];
  readonly commonMistakes: readonly string[];
}) {
  const hasQuestionWarnings = commonMistakes.length > 0;
  return (
    <div className="rounded-lg border border-border bg-background/65 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <NotebookTabsIcon className="size-4" />
          Answer review
        </div>
        <Badge variant="outline">After answer</Badge>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.62fr)]">
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">Worked answer</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
            {solutionSteps.map((step) => (
              <li key={step}>
                <StudyMarkdown className="study-markdown-compact" content={step} />
              </li>
            ))}
          </ol>
        </section>

        {hasQuestionWarnings ? (
          <aside className="space-y-3">
            <section className="rounded-md border border-border bg-muted/30 px-3 py-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                Watch for this question
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                {commonMistakes.map((mistake) => (
                  <li key={mistake}>
                    <StudyMarkdown className="study-markdown-compact" content={mistake} />
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        ) : null}
      </div>
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
  candidate,
  documentTitle,
  sourceDocument,
  topic,
  supportSummary,
  supportConfidence,
  expectedAnswer,
  sourceAssets,
}: {
  readonly question: StudyQuestion | null;
  readonly candidate: StudyQuestionCandidate | null;
  readonly documentTitle: string | null;
  readonly sourceDocument: StudySourceDocument | null;
  readonly topic: ReturnType<typeof getQuestionTopic>;
  readonly supportSummary: string | null;
  readonly supportConfidence: number | null;
  readonly expectedAnswer: readonly string[];
  readonly sourceAssets: readonly StudySourceAsset[];
}) {
  const extractionWarnings = sourceDocument?.warnings ?? [];
  const extractionStatus =
    candidate?.needsManualReview || question?.dependsOnAssets || extractionWarnings.length > 0
      ? "Needs review"
      : question && question.extractionConfidence >= 0.8
        ? "High confidence"
        : "Check extraction";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 text-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FileTextIcon className="size-4" />
        About this question
      </div>
      {question ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={question.isRealQuestion ? "success" : "warning"}>
              {question.isRealQuestion ? "Real past question" : "Generated variant"}
            </Badge>
            <Badge variant="outline">{question.pointValue} pts</Badge>
            {question.sourceYear ? <Badge variant="outline">{question.sourceYear}</Badge> : null}
          </div>
          {topic ? (
            <ContextRow label="Classification" value={`${topic.topic} / ${topic.subtype}`} />
          ) : null}
          {topic ? (
            <ContextRow
              label="Topic match"
              value={`${Math.round(topic.confidence * 100)}% confidence`}
            />
          ) : null}
          <ContextRow label="Document" value={documentTitle ?? question.documentId} />
          <ContextRow label="Anchor" value={question.sourceAnchor} />
          <div>
            <div className="text-xs font-medium text-muted-foreground">Extraction</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={extractionStatus === "High confidence" ? "success" : "warning"}>
                {extractionStatus}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {Math.round(question.extractionConfidence * 100)}% confidence
              </span>
            </div>
          </div>
          <ContextRow
            label="Required source material"
            value={
              question.dependsOnAssets
                ? `${sourceAssets.length} linked asset${sourceAssets.length === 1 ? "" : "s"}`
                : "No linked assets required"
            }
          />
          {supportConfidence !== null ? (
            <ContextRow
              label="Study support"
              value={`${Math.round(supportConfidence * 100)}% confidence`}
            />
          ) : null}
          {supportSummary ? (
            <div className="rounded-md border border-border bg-muted/35 p-3">
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

      {extractionWarnings.length > 0 ? (
        <div className="rounded-lg border border-warning/20 bg-warning/8 px-3 py-2 text-xs text-warning-foreground">
          <div className="font-medium">Extraction warnings</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {extractionWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
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
                  <li key={step}>
                    <StudyMarkdown className="study-markdown-compact" content={step} />
                  </li>
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
