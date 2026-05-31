import {
  BookOpenIcon,
  CircleAlertIcon,
  ClipboardCheckIcon,
  ChevronRightIcon,
  FileJsonIcon,
  FilePlus2Icon,
  FolderOpenIcon,
  GraduationCapIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react";
import { autoAnimate } from "@formkit/auto-animate";
import { Link, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { APP_DISPLAY_NAME, APP_VERSION } from "~/branding";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { SettingsSidebarNav } from "~/components/settings/SettingsSidebarNav";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { importStudyFolder } from "~/study/studyFolderImport";
import { parseStudyImportJson } from "~/study/studyImport";
import { getBestAttempt, getQuestionsForTopicThread } from "~/study/studyLogic";
import { analyzeStudyProject } from "~/study/studyProjectAnalysis";
import {
  filesFromDrop,
  makeOpenedSourceMaterials,
  openedSourceRootName,
  type OpenedSourceMaterial,
} from "~/study/studySourceMaterials";
import { useStudyFrameStore } from "~/study/studyStore";
import type { StudyDataset } from "~/study/studyTypes";
import { ensureLocalApi } from "~/localApi";
import { cn } from "~/lib/utils";

const SIDEBAR_LIST_ANIMATION_OPTIONS = {
  duration: 180,
  easing: "ease-out",
} as const;

export function StudySidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const isOnSettings = pathname.startsWith("/settings");
  const dataset = useStudyFrameStore((state) => state.dataset);
  const attempts = useStudyFrameStore((state) => state.attempts);
  const selectedProjectId = useStudyFrameStore((state) => state.selectedProjectId);
  const selectedTopicThreadId = useStudyFrameStore((state) => state.selectedTopicThreadId);
  const selectProject = useStudyFrameStore((state) => state.selectProject);
  const selectTopicThread = useStudyFrameStore((state) => state.selectTopicThread);
  const replaceDataset = useStudyFrameStore((state) => state.replaceDataset);
  const resetStudyProgress = useStudyFrameStore((state) => state.resetStudyProgress);
  const [importOpen, setImportOpen] = useState(false);
  const [analyzingProject, setAnalyzingProject] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState<ReadonlySet<string>>(
    () => new Set(dataset.projects.map((courseProject) => courseProject.id)),
  );
  const animatedListsRef = useRef(new WeakSet<HTMLElement>());
  const attachListAutoAnimateRef = useCallback((node: HTMLElement | null) => {
    if (!node || animatedListsRef.current.has(node)) return;
    autoAnimate(node, SIDEBAR_LIST_ANIMATION_OPTIONS);
    animatedListsRef.current.add(node);
  }, []);
  const toggleCourse = useCallback((projectId: string) => {
    setExpandedCourseIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);
  useEffect(() => {
    const projectIds = new Set(dataset.projects.map((courseProject) => courseProject.id));
    setExpandedCourseIds((current) => {
      const next = new Set([...current].filter((projectId) => projectIds.has(projectId)));
      for (const projectId of projectIds) {
        if (!current.has(projectId)) next.add(projectId);
      }
      return next;
    });
  }, [dataset.projects]);
  const [analysisStatus, setAnalysisStatus] = useState<{
    readonly tone: "error" | "success";
    readonly message: string;
  } | null>(null);
  const project = dataset.projects.find((candidate) => candidate.id === selectedProjectId);
  const courseProjects = dataset.projects;
  const sortedTopicThreads = [...dataset.topicThreads].sort(
    (left, right) => right.priorityScore - left.priorityScore,
  );

  if (isOnSettings) {
    return (
      <>
        <StudySidebarHeader subtitle="Settings" />
        <SettingsSidebarNav pathname={pathname} />
      </>
    );
  }

  const handleAnalyzeProject = (projectId = selectedProjectId): Promise<void> => {
    if (!projectId || analyzingProject) return Promise.resolve();
    setAnalyzingProject(true);
    setAnalysisStatus(null);
    return analyzeStudyProject({ projectId })
      .then(({ snapshot, result }) => {
        replaceDataset(snapshot.dataset);
        setAnalysisStatus({
          tone: "success",
          message: `Analyzed ${result.classifiedQuestionCount} questions into ${result.topicClusterCount} topic threads (${result.mode === "ai" ? "AI" : "local fallback"}).`,
        });
      })
      .catch((cause) => {
        setAnalysisStatus({
          tone: "error",
          message: cause instanceof Error ? cause.message : "Could not analyze this course.",
        });
      })
      .finally(() => {
        setAnalyzingProject(false);
      });
  };

  return (
    <>
      <SidebarHeader className="gap-3 border-b border-border px-3 py-3">
        <StudySidebarHeaderContent subtitle="Real-question practice" />

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
          <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">Courses</div>
          <SidebarMenu ref={attachListAutoAnimateRef}>
            {courseProjects.map((courseProject) => {
              const isProjectActive = selectedProjectId === courseProject.id;
              const isCourseExpanded = expandedCourseIds.has(courseProject.id);
              const projectTopicThreads = sortedTopicThreads.filter(
                (thread) => thread.projectId === courseProject.id,
              );
              const activeTopicThread =
                isProjectActive && selectedTopicThreadId
                  ? (projectTopicThreads.find((thread) => thread.id === selectedTopicThreadId) ??
                    null)
                  : null;
              const renderedTopicThreads = isCourseExpanded
                ? projectTopicThreads
                : activeTopicThread
                  ? [activeTopicThread]
                  : [];
              const projectQuestionCount = projectTopicThreads.reduce(
                (count, thread) =>
                  count +
                  getQuestionsForTopicThread(dataset, thread.id).filter(
                    (question) => question.isRealQuestion,
                  ).length,
                0,
              );

              return (
                <SidebarMenuItem key={courseProject.id}>
                  <div className="group/course-header relative flex items-stretch">
                    <button
                      type="button"
                      aria-expanded={isCourseExpanded}
                      aria-label={`${isCourseExpanded ? "Collapse" : "Expand"} ${courseProject.name}`}
                      className="absolute top-2 left-1 z-10 flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-hidden transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => toggleCourse(courseProject.id)}
                    >
                      <ChevronRightIcon
                        className={cn(
                          "size-4 shrink-0 transition-transform duration-150",
                          isCourseExpanded && "rotate-90",
                        )}
                      />
                    </button>
                    <SidebarMenuButton
                      isActive={isProjectActive && selectedTopicThreadId === null}
                      data-testid={`course-row-${courseProject.id}`}
                      className="h-auto items-start gap-2 py-2 pl-9 transition-colors duration-150 hover:bg-foreground/[0.06] group-hover/course-header:bg-foreground/[0.06]"
                      onClick={() => {
                        selectProject(courseProject.id);
                        setExpandedCourseIds((current) => {
                          if (current.has(courseProject.id)) return current;
                          const next = new Set(current);
                          next.add(courseProject.id);
                          return next;
                        });
                      }}
                      render={<button type="button" />}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                        <div className="flex min-w-0 items-center gap-2">
                          <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium">{courseProject.name}</span>
                          {courseProject.extractionWarnings.length > 0 ? (
                            <Badge size="sm" variant="outline">
                              {courseProject.extractionWarnings.length} warn
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{projectTopicThreads.length} topics</span>
                          <span>{projectQuestionCount} real questions</span>
                        </div>
                        <div className="line-clamp-1 text-xs text-muted-foreground/80">
                          {courseProject.sourceRoot}
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </div>
                  <SidebarMenuSub
                    ref={attachListAutoAnimateRef}
                    className="overflow-hidden transition-colors duration-150"
                  >
                    {renderedTopicThreads.map((thread) => {
                      const questions = getQuestionsForTopicThread(dataset, thread.id);
                      const realQuestions = questions.filter((question) => question.isRealQuestion);
                      const generatedQuestions = questions.length - realQuestions.length;
                      const attempted = realQuestions.filter(
                        (question) => getBestAttempt(attempts, question.id) !== null,
                      ).length;
                      const isActive = selectedTopicThreadId === thread.id;

                      return (
                        <SidebarMenuSubItem key={thread.id}>
                          <SidebarMenuSubButton
                            isActive={isActive}
                            data-testid={`topic-row-${thread.id}`}
                            className={cn(
                              "h-auto items-start py-2 text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground",
                              isActive &&
                                "bg-foreground/[0.06] font-medium text-foreground hover:bg-foreground/[0.08]",
                            )}
                            onClick={() => selectTopicThread(thread.id)}
                            render={<button type="button" />}
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {thread.displayName}
                                </span>
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
                                value={
                                  realQuestions.length === 0 ? 0 : attempted / realQuestions.length
                                }
                              />
                            </div>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
          {project && project.extractionWarnings.length > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/20 bg-warning/8 px-2 py-1.5 text-xs text-warning-foreground">
              <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{project.extractionWarnings.length} extraction warnings</span>
            </div>
          ) : null}
          <Button
            className="mt-3 w-full justify-start"
            size="sm"
            variant="outline"
            disabled={!project || analyzingProject}
            onClick={() => void handleAnalyzeProject()}
          >
            {analyzingProject ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <ClipboardCheckIcon className="size-4" />
            )}
            {analyzingProject ? "Checking priorities" : "Check priorities"}
          </Button>
          {analysisStatus ? (
            <div
              className={cn(
                "mt-2 px-2 text-xs",
                analysisStatus.tone === "error"
                  ? "text-destructive-foreground"
                  : "text-muted-foreground",
              )}
            >
              {analysisStatus.message}
            </div>
          ) : null}
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
        }}
        analyzingProject={analyzingProject}
        onCheckPriorities={handleAnalyzeProject}
        onImport={(rawJson) => {
          replaceDataset(parseStudyImportJson(rawJson, new Date().toISOString()));
          setImportOpen(false);
        }}
      />
    </>
  );
}

function StudySidebarHeader({ subtitle }: { readonly subtitle: string }) {
  return (
    <SidebarHeader className="gap-3 border-b border-border px-3 py-3">
      <StudySidebarHeaderContent subtitle={subtitle} />
    </SidebarHeader>
  );
}

function StudySidebarHeaderContent({ subtitle }: { readonly subtitle: string }) {
  return (
    <div className="flex items-center gap-2">
      <SidebarTrigger className="size-7 shrink-0 md:hidden" />
      <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground">
        <GraduationCapIcon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{APP_DISPLAY_NAME}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-[180ms] ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StudyImportDialog({
  open,
  onOpenChange,
  projectId,
  onFolderImported,
  analyzingProject,
  onCheckPriorities,
  onImport,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly projectId: string | null;
  readonly onFolderImported: (dataset: StudyDataset) => void;
  readonly analyzingProject: boolean;
  readonly onCheckPriorities: (projectId: string) => Promise<void>;
  readonly onImport: (rawJson: string) => void;
}) {
  const [rawJson, setRawJson] = useState("");
  const [sourceRoot, setSourceRoot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importingFolder, setImportingFolder] = useState(false);
  const [folderImportSummary, setFolderImportSummary] = useState<string | null>(null);
  const [secondaryOptionsOpen, setSecondaryOptionsOpen] = useState(false);
  const [importedProjectId, setImportedProjectId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [openedMaterials, setOpenedMaterials] = useState<readonly OpenedSourceMaterial[]>([]);
  const [materialPreview, setMaterialPreview] = useState<{
    readonly materialId: string;
    readonly title: string;
    readonly content: string;
  } | null>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setError(null);
      setFolderImportSummary(null);
      setImportedProjectId(null);
      setOpenedMaterials([]);
      setMaterialPreview(null);
    }
    onOpenChange(nextOpen);
  };

  const handleImport = () => {
    try {
      onImport(rawJson);
      setRawJson("");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import this file.");
    }
  };

  const applyFolderImport = ({
    snapshot,
    result,
  }: Awaited<ReturnType<typeof importStudyFolder>>) => {
    onFolderImported(snapshot.dataset);
    setImportedProjectId(result.projectId);
    setFolderImportSummary(
      `Imported ${result.importedDocumentCount} files and ${result.questionCandidateCount} question candidates.`,
    );
    setSourceRoot("");
  };

  const openFolderPath = (folderPath: string) => {
    setSourceRoot(folderPath);
    setImportedProjectId(null);
    setError(null);
    setFolderImportSummary(
      `Opened ${folderPath}. Source extraction will run when you choose Extract sources.`,
    );
  };

  const importFolderPath = (folderPath: string) => {
    setImportingFolder(true);
    setError(null);
    setFolderImportSummary(null);
    void importStudyFolder({ projectId, sourceRoot: folderPath })
      .then(applyFolderImport)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not import this folder.");
      })
      .finally(() => {
        setImportingFolder(false);
      });
  };

  const handleCheckPriorities = () => {
    if (!importedProjectId || analyzingProject) return;
    void onCheckPriorities(importedProjectId).then(() => {
      handleOpenChange(false);
    });
  };

  const handleOpenFolder = () => {
    if (importingFolder) return;
    if (!window.desktopBridge) {
      directoryInputRef.current?.click();
      return;
    }
    void ensureLocalApi()
      .dialogs.pickFolder()
      .then((folderPath) => {
        if (!folderPath) return;
        openFolderPath(folderPath);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not open the folder picker.");
      });
  };

  const openMaterials = (files: readonly File[]) => {
    if (files.length === 0) return;
    const materials = makeOpenedSourceMaterials(files);
    const rootName = openedSourceRootName(materials);
    setOpenedMaterials(materials);
    setMaterialPreview(null);
    setImportedProjectId(null);
    setError(null);
    setFolderImportSummary(
      `Opened ${materials.length} ${materials.length === 1 ? "material" : "materials"} from ${rootName}. No files were uploaded.`,
    );
  };

  const handleDirectoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    openMaterials(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleSourceDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragActive(false);
    void filesFromDrop(event.dataTransfer)
      .then(openMaterials)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not read the dropped sources.");
      });
  };

  const handleFolderPathOpen = () => {
    const trimmedSourceRoot = sourceRoot.trim();
    if (!trimmedSourceRoot) return;
    openFolderPath(trimmedSourceRoot);
  };

  const handleExtractSources = () => {
    const trimmedSourceRoot = sourceRoot.trim();
    if (!trimmedSourceRoot || importingFolder) return;
    importFolderPath(trimmedSourceRoot);
  };

  const handleMaterialPreview = (material: OpenedSourceMaterial) => {
    setMaterialPreview({
      materialId: material.id,
      title: material.relativePath,
      content: "Loading preview...",
    });
    const textual =
      material.type.startsWith("text/") ||
      /\.(?:csv|json|md|markdown|txt)$/iu.test(material.relativePath);
    if (!textual) {
      setMaterialPreview({
        materialId: material.id,
        title: material.relativePath,
        content: `Preview is available on demand for text-like files. ${material.name} is ${formatBytes(material.size)}${material.type ? ` (${material.type})` : ""}.`,
      });
      return;
    }
    void material.file
      .slice(0, 16_384)
      .text()
      .then((content) => {
        setMaterialPreview({
          materialId: material.id,
          title: material.relativePath,
          content:
            material.size > 16_384
              ? `${content}\n\n[Preview truncated at 16 KB. No upload performed.]`
              : content,
        });
      })
      .catch((cause) => {
        setMaterialPreview({
          materialId: material.id,
          title: material.relativePath,
          content: cause instanceof Error ? cause.message : "Could not read this material.",
        });
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import course</DialogTitle>
          <DialogDescription>
            Open a course folder or review a dropped material list first. Extraction runs only when
            you choose it.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div
            className={cn(
              "rounded-lg border border-border bg-background/65 p-4 transition-colors",
              dragActive && "border-primary bg-primary/8",
            )}
            onDragEnter={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget;
              if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
              setDragActive(false);
            }}
            onDrop={handleSourceDrop}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium">Course folder</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Select a server-visible folder path for extraction, or open/drop materials here to
                  inspect the source list without uploading.
                </div>
              </div>
              <Button className="shrink-0" disabled={importingFolder} onClick={handleOpenFolder}>
                {importingFolder ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <FolderOpenIcon className="size-4" />
                )}
                {importingFolder ? "Extracting" : "Open folder"}
              </Button>
              <input
                ref={directoryInputRef}
                className="sr-only"
                type="file"
                multiple
                onChange={handleDirectoryChange}
                {...{ directory: "", webkitdirectory: "" }}
              />
            </div>
            <div
              className={cn(
                "mt-3 rounded-md border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground",
                dragActive && "border-primary text-foreground",
              )}
            >
              {dragActive
                ? "Drop to open the material list"
                : "Drag and drop materials or folders to list them"}
            </div>
            {folderImportSummary ? (
              <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {folderImportSummary}
              </div>
            ) : null}
            {openedMaterials.length > 0 ? (
              <div className="mt-3 rounded-md border border-border bg-muted/20 p-2">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {openedMaterials.length} opened{" "}
                    {openedMaterials.length === 1 ? "material" : "materials"}
                  </span>
                  <span>No upload</span>
                </div>
                <div className="max-h-40 space-y-1 overflow-auto pr-1">
                  {openedMaterials.slice(0, 60).map((material) => (
                    <button
                      key={material.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-foreground/[0.06]",
                        materialPreview?.materialId === material.id && "bg-foreground/[0.06]",
                      )}
                      onClick={() => handleMaterialPreview(material)}
                    >
                      <span className="min-w-0 truncate">{material.relativePath}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatBytes(material.size)}
                      </span>
                    </button>
                  ))}
                </div>
                {openedMaterials.length > 60 ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Showing first 60 materials. The full list stays open in memory.
                  </div>
                ) : null}
                {materialPreview ? (
                  <div className="mt-2 rounded-md border border-border bg-background/80 p-2">
                    <div className="mb-1 truncate text-xs font-medium">{materialPreview.title}</div>
                    <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                      {materialPreview.content}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSecondaryOptionsOpen((current) => !current)}
            >
              <FilePlus2Icon className="size-4" />
              Source material options
            </Button>
          </div>

          {secondaryOptionsOpen ? (
            <div className="mt-3 space-y-4 rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Server-visible folder path
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={sourceRoot}
                    onChange={(event) => {
                      setSourceRoot(event.target.value);
                      setImportedProjectId(null);
                    }}
                    placeholder="G:\My Drive\Bar-Ilan\Signal and Data Analysis\Quiz"
                  />
                  <Button
                    className="shrink-0"
                    size="sm"
                    disabled={sourceRoot.trim().length === 0}
                    onClick={handleFolderPathOpen}
                  >
                    <FolderOpenIcon className="size-4" />
                    Open path
                  </Button>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  This records the path only. Extraction starts from the footer action.
                </div>
              </div>

              <div className="h-px bg-border" />

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
                className="min-h-56 font-mono text-xs"
                value={rawJson}
                onChange={(event) => setRawJson(event.target.value)}
              />
            </div>
          ) : null}
          {error ? (
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground">
              {error}
            </div>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {!importedProjectId ? (
            <Button
              variant="outline"
              disabled={sourceRoot.trim().length === 0 || importingFolder}
              onClick={handleExtractSources}
            >
              {importingFolder ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <FilePlus2Icon className="size-4" />
              )}
              {importingFolder ? "Extracting" : "Extract sources"}
            </Button>
          ) : null}
          {secondaryOptionsOpen && rawJson.trim().length > 0 ? (
            <Button variant="outline" onClick={handleImport}>
              Import JSON
            </Button>
          ) : null}
          <Button disabled={!importedProjectId || analyzingProject} onClick={handleCheckPriorities}>
            {analyzingProject ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <ClipboardCheckIcon className="size-4" />
            )}
            {analyzingProject ? "Checking priorities" : "Check priorities"}
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
