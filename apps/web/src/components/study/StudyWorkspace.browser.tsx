import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Sidebar, SidebarProvider } from "~/components/ui/sidebar";
import { studySeedData } from "~/study/studySeedData";
import { useStudyFrameStore } from "~/study/studyStore";
import { StudySidebar } from "./StudySidebar";
import { StudyWorkspace } from "./StudyWorkspace";

vi.mock("~/study/studyServerSync", () => ({
  installStudyFrameServerSync: () => () => {},
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { readonly children: React.ReactNode }) => <a>{children}</a>,
  useLocation: (opts?: { select?: (location: { pathname: string }) => unknown }) => {
    const location = { pathname: "/" };
    return opts?.select ? opts.select(location) : location;
  },
}));

describe("StudyWorkspace", () => {
  let mounted:
    | (Awaited<ReturnType<typeof render>> & {
        cleanup?: () => Promise<void>;
        unmount?: () => Promise<void>;
      })
    | null = null;

  beforeEach(() => {
    localStorage.clear();
    useStudyFrameStore.getState().replaceDataset(studySeedData);
    useStudyFrameStore.getState().resetStudyProgress();
  });

  afterEach(async () => {
    if (mounted) {
      const teardown = mounted.cleanup ?? mounted.unmount;
      await teardown?.call(mounted).catch(() => {});
    }
    mounted = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  async function renderWorkspace() {
    mounted = await render(
      <SidebarProvider>
        <StudyWorkspace />
      </SidebarProvider>,
    );
  }

  async function openSpikeTrainTopic() {
    useStudyFrameStore.getState().selectTopicThread("topic-spike-train-statistics");
    await renderWorkspace();
  }

  async function openExtraInfoSection(name: string) {
    const questionDetails = page.getByRole("button", { name: "Question details", exact: true });
    if (await questionDetails.query()) {
      await questionDetails.click();
    } else {
      await page.getByRole("button", { name: "Extra information", exact: true }).click();
    }
    await page.getByRole("menuitem", { name, exact: true }).click();
  }

  async function showCurrentAnswer() {
    await page.getByRole("button", { name: "Check direction", exact: true }).click();
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await page.getByRole("button", { name: "Show answer", exact: true }).click();
  }

  it("starts on the course dashboard with learning tracker and priority statistics", async () => {
    await renderWorkspace();

    await expect
      .element(page.getByRole("heading", { name: "Learning tracker" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Topic priority", { exact: true }).first())
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Spike-train statistics", exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Real-question queue", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Close extra information", exact: true }))
      .not.toBeInTheDocument();
  });

  it("shows the streamlined topic workspace without leaking answers", async () => {
    await openSpikeTrainTopic();

    await expect
      .element(page.getByText("Real-question queue", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Topic priority", { exact: true }).first())
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Spike-train statistics", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Quiz 2024 Q2", { exact: true }).first())
      .toBeInTheDocument();
    await expect
      .element(page.getByText("2024.pdf#page=3&q=2", { exact: true }).first())
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Generate similar questions", exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Brief Explanation", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("Spike-train statistics describe how neurons fire over time"))
      .toBeVisible();
    await expect.element(page.getByText("Core quantities", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Subtopics", { exact: true })).not.toBeInTheDocument();
    await expect
      .element(page.getByText("Recurring question types", { exact: true }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText("Problems", { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText("Solve flow", { exact: true })).not.toBeInTheDocument();
    await expect
      .element(page.getByText("Convert milliseconds to seconds before computing Hz."))
      .not.toBeInTheDocument();

    await openExtraInfoSection("Question queue");
    await expect
      .element(page.getByText("Real-question queue", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Generate similar questions", exact: true }))
      .toBeDisabled();
    await expect
      .element(page.getByText("Question support", { exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByText("Expected answer markers", { exact: true }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText("Solution", { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText("16 Hz", { exact: true })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Question details", exact: true }).click();
    await expect.element(page.getByText("High confidence", { exact: true })).toBeInTheDocument();
    await page.getByRole("button", { name: "Question queue", exact: true }).click();
    await page.getByRole("button", { name: "Close extra information", exact: true }).click();

    await page.getByRole("button", { name: "Check direction", exact: true }).click();
    await expect.element(page.getByText("Direction check", { exact: true })).toBeInTheDocument();
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await expect
      .element(page.getByText("Start by converting the observation window into seconds."))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Direction check", { exact: true }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText("16 Hz", { exact: true })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Show answer", exact: true }).click();
    await expect.element(page.getByText("Answer review", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Worked answer", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByText("Watch for this question", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Topic trap bank", { exact: true }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText(/16 Hz/).first()).toBeInTheDocument();
    await expect.element(page.getByText("Using 500 instead of 0.5 seconds.")).toBeInTheDocument();
    await expect
      .element(page.getByText("Convert milliseconds to seconds before computing Hz."))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByPlaceholder("Work the real question here..."))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Show answer", exact: true }))
      .not.toBeInTheDocument();
  });

  it("keeps source context behind the right metadata tab", async () => {
    await openSpikeTrainTopic();

    await expect
      .element(page.getByRole("button", { name: "Close extra information", exact: true }))
      .not.toBeInTheDocument();
    await openExtraInfoSection("About this question");
    await expect.element(page.getByText("High confidence", { exact: true })).toBeVisible();
    await expect
      .element(page.getByText("Question support", { exact: true }))
      .not.toBeInTheDocument();
    await page.getByRole("button", { name: "Close extra information", exact: true }).click();
    await expect
      .element(page.getByRole("button", { name: "Close extra information", exact: true }))
      .not.toBeInTheDocument();
  });

  it("supports direction checks, submission feedback, and attempt history", async () => {
    await openSpikeTrainTopic();

    await page
      .getByPlaceholder("Work the real question here...")
      .fill(
        "500 ms is 0.5 seconds. 8 / 0.5 = 16 Hz. Fano factor is 12 / 8 = 1.5, so the process is more variable than Poisson.",
      );
    await page.getByRole("button", { name: "Check direction", exact: true }).click();
    await expect.element(page.getByText("Direction check", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Answer review", { exact: true })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect.element(page.getByText("Feedback", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Attempt history", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Best 100%", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByText("Expected answer markers", { exact: true }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText("Answer review", { exact: true })).toBeInTheDocument();
    await openExtraInfoSection("About this question");
    await expect
      .element(page.getByText("Expected answer markers", { exact: true }))
      .toBeInTheDocument();
  });

  it("renders equations inside revealed solution steps", async () => {
    useStudyFrameStore.getState().replaceDataset({
      ...studySeedData,
      questionSupport: studySeedData.questionSupport.map((support) =>
        support.questionId === "q-info-2024-mutual-info"
          ? {
              ...support,
              solutionSteps: ["Compute $H(S)=1$ bit before evaluating $H(S\\mid R)$."],
            }
          : support,
      ),
    });
    useStudyFrameStore.getState().selectTopicThread("topic-information-theory");
    await renderWorkspace();

    await showCurrentAnswer();

    expect(document.querySelector(".katex")).not.toBeNull();
    expect(document.body.textContent).not.toContain("$H(S)=1$");
  });

  it("unlocks generated practice only after all real questions are attempted", async () => {
    await openSpikeTrainTopic();

    await showCurrentAnswer();
    await page.getByRole("button", { name: "Next question", exact: true }).click();
    await expect
      .element(page.getByText(/Given inter-spike intervals with mean 25 ms/))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Brief Explanation", exact: true }))
      .toBeVisible();
    await showCurrentAnswer();

    const dialog = page.getByRole("dialog", { name: "You finished all real questions." });
    await expect.element(page.getByText("Feedback", { exact: true })).toBeInTheDocument();
    await expect.element(dialog).not.toBeInTheDocument();
    await page.getByRole("button", { name: "View results", exact: true }).click();
    await expect.element(dialog).toBeInTheDocument();
    await expect
      .element(
        dialog.getByText("Real-question performance stays separate from generated practice."),
      )
      .toBeInTheDocument();
    await dialog.getByRole("button", { name: "Generate similar questions", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(page.getByText("Generated", { exact: true }).first()).toBeInTheDocument();
    await expect
      .element(page.getByText(/Generated variant based on Quiz 2023 Q1/))
      .toBeInTheDocument();
    await expect.element(page.getByText("2 generated", { exact: true })).toBeInTheDocument();
  });

  it("offers a solution-review mode after exhausting real questions", async () => {
    await openSpikeTrainTopic();

    await showCurrentAnswer();
    await page.getByRole("button", { name: "Next question", exact: true }).click();
    await showCurrentAnswer();
    const dialog = page.getByRole("dialog", { name: "You finished all real questions." });
    await expect.element(dialog).not.toBeInTheDocument();
    await page.getByRole("button", { name: "View results", exact: true }).click();
    await dialog.getByRole("button", { name: "Review solutions only", exact: true }).click();

    await expect.element(page.getByText("Solution review", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByText(/A neuron is observed across 20 identical trials/))
      .toBeInTheDocument();
    await expect
      .element(page.getByText(/Given inter-spike intervals with mean 25 ms/))
      .toBeInTheDocument();
  });

  it("exposes markdown report downloads", async () => {
    await renderWorkspace();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await openExtraInfoSection("Reports");
    await page.getByRole("button", { name: "Topic priority", exact: true }).click();
    await page.getByRole("button", { name: "Score summary", exact: true }).click();
    await page.getByRole("button", { name: "Final report", exact: true }).click();

    expect(clickSpy).toHaveBeenCalledTimes(3);
  });
});

describe("StudySidebar", () => {
  let mounted:
    | (Awaited<ReturnType<typeof render>> & {
        cleanup?: () => Promise<void>;
        unmount?: () => Promise<void>;
      })
    | null = null;

  beforeEach(() => {
    localStorage.clear();
    useStudyFrameStore.getState().replaceDataset(studySeedData);
    useStudyFrameStore.getState().resetStudyProgress();
  });

  afterEach(async () => {
    if (mounted) {
      const teardown = mounted.cleanup ?? mounted.unmount;
      await teardown?.call(mounted).catch(() => {});
    }
    mounted = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  async function renderSidebar() {
    mounted = await render(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <StudySidebar />
        </Sidebar>
      </SidebarProvider>,
    );
  }

  it("collapses courses smoothly while keeping the active topic available", async () => {
    await renderSidebar();

    await expect.element(page.getByText("Spike-train statistics", { exact: true })).toBeVisible();
    await page.getByText("Information theory", { exact: true }).click();
    await page
      .getByRole("button", { name: "Collapse Signal and Data Analysis", exact: true })
      .click();
    await expect
      .element(page.getByRole("button", { name: "Expand Signal and Data Analysis", exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByText("Information theory", { exact: true })).toBeVisible();
    await expect
      .element(page.getByText("Spike-train statistics", { exact: true }))
      .not.toBeInTheDocument();

    await page
      .getByRole("button", { name: "Expand Signal and Data Analysis", exact: true })
      .click();
    await expect.element(page.getByText("Spike-train statistics", { exact: true })).toBeVisible();

    await page.getByText("Information theory", { exact: true }).click();
    expect(useStudyFrameStore.getState().selectedTopicThreadId).toBe("topic-information-theory");
  });

  it("keeps the opened topic highlighted and moves the highlight when another topic opens", async () => {
    await renderSidebar();

    const spikeTrainRow = page.getByTestId("topic-row-topic-spike-train-statistics");
    const informationTheoryRow = page.getByTestId("topic-row-topic-information-theory");
    const rowBackground = (testId: string) =>
      getComputedStyle(document.querySelector(`[data-testid="${testId}"]`)!).backgroundColor;
    const inactiveInformationTheoryBackground = rowBackground("topic-row-topic-information-theory");
    await expect.element(spikeTrainRow).toHaveAttribute("data-active", "false");
    await expect.element(informationTheoryRow).toHaveAttribute("data-active", "false");

    await informationTheoryRow.hover();
    expect(rowBackground("topic-row-topic-information-theory")).not.toBe(
      inactiveInformationTheoryBackground,
    );

    await informationTheoryRow.click();
    await spikeTrainRow.hover();

    await expect.element(spikeTrainRow).toHaveAttribute("data-active", "false");
    await expect.element(informationTheoryRow).toHaveAttribute("data-active", "true");
    expect(rowBackground("topic-row-topic-information-theory")).not.toBe(
      inactiveInformationTheoryBackground,
    );

    await spikeTrainRow.click();
    await informationTheoryRow.hover();

    await expect.element(spikeTrainRow).toHaveAttribute("data-active", "true");
    await expect.element(informationTheoryRow).toHaveAttribute("data-active", "false");
    expect(rowBackground("topic-row-topic-spike-train-statistics")).not.toBe(
      inactiveInformationTheoryBackground,
    );
  });

  it("imports example course JSON and resets demo progress", async () => {
    await renderSidebar();

    await page.getByRole("button", { name: "Import course", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import course" });
    await expect.element(dialog).toBeInTheDocument();
    await expect
      .element(dialog.getByRole("button", { name: "Open folder", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(dialog.getByText("Drag and drop materials or folders to prepare them"))
      .toBeInTheDocument();
    const directoryClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    await dialog.getByRole("button", { name: "Open folder", exact: true }).click();
    expect(directoryClick).toHaveBeenCalledOnce();
    directoryClick.mockRestore();
    await expect
      .element(dialog.getByRole("button", { name: "Process course", exact: true }))
      .toBeDisabled();
    await dialog.getByRole("button", { name: "Source material options", exact: true }).click();
    await dialog.getByRole("button", { name: "Example", exact: true }).click();
    await dialog.getByRole("button", { name: "Import JSON", exact: true }).click();
    await expect.element(page.getByText("Imported Course", { exact: true })).toBeInTheDocument();

    await page.getByRole("button", { name: "Reset demo progress", exact: true }).click();
    await expect
      .element(page.getByText("Signal and Data Analysis", { exact: true }))
      .toBeInTheDocument();
  });

  it("stages a browser-selected folder and enables course processing", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sourceRoot: "C:\\staged\\Signal", materialCount: 1 }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await renderSidebar();
    await page.getByRole("button", { name: "Import course", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import course" });
    const input = document.querySelector<HTMLInputElement>("input[webkitdirectory]");
    expect(input).not.toBeNull();
    const file = new File(["Question 1\nCompute the firing rate."], "quiz-2024.md", {
      type: "text/markdown",
    });
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: "Signal/quiz-2024.md",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    Object.defineProperty(input, "files", {
      configurable: true,
      value: transfer.files,
    });
    input?.dispatchEvent(new Event("change", { bubbles: true }));

    await expect
      .element(dialog.getByText("Prepared 1 material from Signal. Choose Process course to begin."))
      .toBeInTheDocument();
    await expect
      .element(dialog.getByRole("button", { name: "Process course", exact: true }))
      .toBeEnabled();
  });

  it("releases processing actions as soon as a course job succeeds", async () => {
    const completedAt = "2026-06-01T02:51:33.837Z";
    const runningJob = {
      id: "study-job-visible",
      projectId: "signal-data-analysis",
      sourceRoot: "G:\\My Drive\\Bar-Ilan\\Signal and Data Analysis\\Quiz\\2024",
      status: "running",
      stage: "classify_sources",
      progressCurrent: 4,
      progressTotal: 11,
      message: "Classifying sources in batches of up to 50 documents.",
      error: null,
      createdAt: completedAt,
      updatedAt: completedAt,
      completedAt: null,
    };
    const succeededJob = {
      ...runningJob,
      status: "succeeded",
      stage: "completed",
      progressCurrent: 11,
      message: "Course processing completed.",
      updatedAt: completedAt,
      completedAt,
    };
    const snapshotResolver: { current: ((response: Response) => void) | null } = {
      current: null,
    };
    const snapshotResponse = new Promise<Response>((resolve) => {
      snapshotResolver.current = resolve;
    });
    vi.spyOn(window, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/api/studyframe/process-folder")) {
        return Promise.resolve(
          new Response(JSON.stringify({ job: runningJob }), {
            status: 202,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (url.includes("/api/studyframe/processing-jobs/study-job-visible/events")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              events: [
                {
                  id: "event-completed",
                  jobId: "study-job-visible",
                  stage: "completed",
                  level: "info",
                  message: "Course processing completed.",
                  metadataJson: null,
                  createdAt: completedAt,
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (url.includes("/api/studyframe/processing-jobs/study-job-visible")) {
        return Promise.resolve(
          new Response(JSON.stringify({ job: succeededJob }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (url.includes("/api/studyframe/snapshot") && init?.method !== "PUT") {
        return snapshotResponse;
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    await renderSidebar();
    await page.getByRole("button", { name: "Import course", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import course" });
    await dialog.getByRole("button", { name: "Source material options", exact: true }).click();
    await dialog
      .getByRole("textbox")
      .first()
      .fill("G:\\My Drive\\Bar-Ilan\\Signal and Data Analysis\\Quiz\\2024");
    await dialog.getByRole("button", { name: "Open path", exact: true }).click();
    await dialog.getByRole("button", { name: "Process course", exact: true }).click();

    await expect
      .element(dialog.getByText("Course processing completed.", { exact: true }).first())
      .toBeInTheDocument();
    await expect.element(dialog.getByText("succeeded", { exact: true })).toBeInTheDocument();
    await expect
      .element(dialog.getByRole("button", { name: "Done", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(dialog.getByRole("button", { name: "Processing", exact: true }))
      .not.toBeInTheDocument();

    const resolveSnapshot = snapshotResolver.current;
    if (!resolveSnapshot) {
      throw new Error("Snapshot resolver was not initialized.");
    }
    resolveSnapshot(
      new Response(
        JSON.stringify({
          snapshot: {
            dataset: studySeedData,
            attempts: [],
            completionSummaries: [],
            generatedQuestionBatches: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  });
});
