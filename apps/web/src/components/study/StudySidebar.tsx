import {
  BookOpenIcon,
  CircleAlertIcon,
  FileJsonIcon,
  FilePlus2Icon,
  GraduationCapIcon,
  RotateCcwIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { APP_DISPLAY_NAME, APP_VERSION } from "~/branding";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { importStudyFolder } from "~/study/studyFolderImport";
import { parseStudyImportJson } from "~/study/studyImport";
import { getBestAttempt, getQuestionsForTopicThread } from "~/study/studyLogic";
import { useStudyFrameStore } from "~/study/studyStore";
import type { StudyDataset } from "~/study/studyTypes";
import { cn } from "~/lib/utils";

export function StudySidebar() {
  const dataset = useStudyFrameStore((state) => state.dataset);
  const attempts = useStudyFrameStore((state) => state.attempts);
  const selectedProjectId = useStudyFrameStore((state) => state.selectedProjectId);
  const selectedTopicThreadId = useStudyFrameStore((state) => state.selectedTopicThreadId);
  const selectTopicThread = useStudyFrameStore((state) => state.selectTopicThread);
  const replaceDataset = useStudyFrameStore((state) => state.replaceDataset);
  const resetStudyProgress = useStudyFrameStore((state) => state.resetStudyProgress);
  const [importOpen, setImportOpen] = useState(false);
  const project = dataset.projects.find((candidate) => candidate.id === selectedProjectId);
  const topicThreads = dataset.topicThreads
    .filter((thread) => thread.projectId === selectedProjectId)
    .sort((left, right) => right.priorityScore - left.priorityScore);

  return (
    <>
      <SidebarHeader className="gap-3 border-b border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-7 shrink-0 md:hidden" />
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground">
            <GraduationCapIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{APP_DISPLAY_NAME}</div>
            <div className="truncate text-xs text-muted-foreground">Real-question practice</div>
          </div>
        </div>

        <Button
          className="w-full justify-start"
          size="sm"
          variant="outline"
          onClick={() => setImportOpen(true)}
        >
          <FilePlus2Icon className="size-4" />
          Import course
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2 py-3">
          <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">Course</div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="flex items-start gap-2">
              <BookOpenIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{project?.name ?? "No course"}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {project?.sourceRoot ?? "No source repository selected."}
                </div>
              </div>
            </div>
            {project && project.extractionWarnings.length > 0 ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/20 bg-warning/8 px-2 py-1.5 text-xs text-warning-foreground">
                <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>{project.extractionWarnings.length} extraction warnings</span>
              </div>
            ) : null}
          </div>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="px-2 py-3">
          <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">Topic threads</div>
          <SidebarMenu>
            {topicThreads.map((thread) => {
              const questions = getQuestionsForTopicThread(dataset, thread.id);
              const realQuestions = questions.filter((question) => question.isRealQuestion);
              const generatedQuestions = questions.length - realQuestions.length;
              const attempted = realQuestions.filter(
                (question) => getBestAttempt(attempts, question.id) !== null,
              ).length;
              const isActive = selectedTopicThreadId === thread.id;

              return (
                <SidebarMenuItem key={thread.id}>
                  <SidebarMenuButton
                    isActive={isActive}
                    className={cn("h-auto items-start py-2", isActive && "bg-sidebar-accent")}
                    onClick={() => selectTopicThread(thread.id)}
                    render={<button type="button" />}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{thread.displayName}</span>
                        {generatedQuestions > 0 ? (
                          <Badge size="sm" variant="outline">
                            {generatedQuestions} gen
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {attempted}/{realQuestions.length} real
                        </span>
                        <span>Priority {Math.round(thread.priorityScore * 100)}</span>
                      </div>
                      <ProgressBar
                        value={realQuestions.length === 0 ? 0 : attempted / realQuestions.length}
                      />
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-border p-2">
        <Button className="justify-start" size="sm" variant="ghost" onClick={resetStudyProgress}>
          <RotateCcwIcon className="size-4" />
          Reset demo progress
        </Button>
        <Button
          className="justify-start"
          size="sm"
          variant="ghost"
          render={<Link to="/settings" />}
        >
          <SettingsIcon className="size-4" />
          Settings
        </Button>
        <div className="px-2 pb-1 text-xs text-muted-foreground">v{APP_VERSION}</div>
      </SidebarFooter>

      <StudyImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={selectedProjectId}
        onFolderImported={(dataset) => {
          replaceDataset(dataset);
          setImportOpen(false);
        }}
        onImport={(rawJson) => {
          replaceDataset(parseStudyImportJson(rawJson, new Date().toISOString()));
          setImportOpen(false);
        }}
      />
    </>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

function StudyImportDialog({
  open,
  onOpenChange,
  projectId,
  onFolderImported,
  onImport,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly projectId: string | null;
  readonly onFolderImported: (dataset: StudyDataset) => void;
  readonly onImport: (rawJson: string) => void;
}) {
  const [rawJson, setRawJson] = useState("");
  const [sourceRoot, setSourceRoot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importingFolder, setImportingFolder] = useState(false);
  const [folderImportSummary, setFolderImportSummary] = useState<string | null>(null);

  const handleImport = () => {
    try {
      onImport(rawJson);
      setRawJson("");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import this file.");
    }
  };

  const handleFolderImport = () => {
    const trimmedSourceRoot = sourceRoot.trim();
    if (!trimmedSourceRoot || importingFolder) return;

    setImportingFolder(true);
    setError(null);
    setFolderImportSummary(null);
    void importStudyFolder({ projectId, sourceRoot: trimmedSourceRoot })
      .then(({ snapshot, result }) => {
        onFolderImported(snapshot.dataset);
        setFolderImportSummary(
          `Imported ${result.importedDocumentCount} files and ${result.questionCandidateCount} question candidates.`,
        );
        setSourceRoot("");
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not import this folder.");
      })
      .finally(() => {
        setImportingFolder(false);
      });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void file
      .text()
      .then((content) => {
        setRawJson(content);
        setError(null);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not read this file.");
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import course</DialogTitle>
          <DialogDescription>
            Import a local course folder through the server, or paste StudyFrame JSON. Imported
            questions become the source practice queue.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="rounded-lg border border-border bg-background/65 p-3">
            <div className="text-xs font-medium text-muted-foreground">Course folder</div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                value={sourceRoot}
                onChange={(event) => setSourceRoot(event.target.value)}
                placeholder="G:\My Drive\Bar-Ilan\Signal and Data Analysis\Quiz"
              />
              <Button
                className="shrink-0"
                size="sm"
                disabled={sourceRoot.trim().length === 0 || importingFolder}
                onClick={handleFolderImport}
              >
                <FilePlus2Icon className="size-4" />
                {importingFolder ? "Importing" : "Import folder"}
              </Button>
            </div>
            {folderImportSummary ? (
              <div className="mt-2 text-xs text-muted-foreground">{folderImportSummary}</div>
            ) : null}
          </div>

          <div className="my-4 h-px bg-border" />

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" render={<label />}>
              <UploadIcon className="size-4" />
              Choose JSON
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
              />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRawJson(JSON.stringify(exampleImportPayload, null, 2));
                setError(null);
              }}
            >
              <FileJsonIcon className="size-4" />
              Example
            </Button>
          </div>
          <Textarea
            className="mt-3 min-h-72 font-mono text-xs"
            value={rawJson}
            onChange={(event) => setRawJson(event.target.value)}
          />
          {error ? (
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground">
              {error}
            </div>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={rawJson.trim().length === 0} onClick={handleImport}>
            Import
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

const exampleImportPayload = {
  project: {
    name: "Imported Course",
    sourceRoot: "Past exams folder",
  },
  questions: [
    {
      sourceQuizLabel: "Exam 2024 Q1",
      sourceYear: 2024,
      pointValue: 10,
      topic: "Core topic",
      subtype: "Subtype A",
      prompt: "Paste the real question prompt here.",
      expectedAnswer: ["answer marker"],
      rubric: [{ label: "Correct setup", points: 4, keywords: ["setup"] }],
      hints: ["Start with the governing formula."],
      solutionSteps: ["Write the setup.", "Compute the result.", "Interpret the answer."],
      commonMistakes: ["Skipping units."],
    },
  ],
} as const;
