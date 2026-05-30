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
    await page.getByRole("button", { name: "Extra information", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
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

    await openExtraInfoSection("Refresher");
    await expect.element(page.getByText("Theory summary", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Question queue", exact: true }).click();
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

    await page.getByRole("button", { name: "Source context", exact: true }).click();
    await expect.element(page.getByText("96% confidence", { exact: true })).toBeInTheDocument();
    await page.getByRole("button", { name: "Question queue", exact: true }).click();
    await page.getByRole("button", { name: "Close extra information", exact: true }).click();

    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await expect
      .element(page.getByText("Start by converting the observation window into seconds."))
      .toBeInTheDocument();
    await expect.element(page.getByText("16 Hz", { exact: true })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
    await expect.element(page.getByText("Solution", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText(/16 Hz/).first()).toBeInTheDocument();
  });

  it("keeps source context behind the right metadata tab", async () => {
    await openSpikeTrainTopic();

    await expect
      .element(page.getByRole("button", { name: "Close extra information", exact: true }))
      .not.toBeInTheDocument();
    await openExtraInfoSection("Source context");
    await expect.element(page.getByText("96% confidence", { exact: true })).toBeVisible();
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
    await expect.element(page.getByText("Solution", { exact: true })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect.element(page.getByText("Feedback", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Attempt history", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Best 100%", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByText("Expected answer markers", { exact: true }))
      .not.toBeInTheDocument();
    await expect.element(page.getByText("Solution", { exact: true })).toBeInTheDocument();
    await openExtraInfoSection("Source context");
    await expect
      .element(page.getByText("Expected answer markers", { exact: true }))
      .toBeInTheDocument();
  });

  it("unlocks generated practice only after all real questions are attempted", async () => {
    await openSpikeTrainTopic();

    await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect
      .element(page.getByText(/Given inter-spike intervals with mean 25 ms/))
      .toBeInTheDocument();
    await page.getByRole("button", { name: "Reveal solution", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "You finished all real questions." });
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

    await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "You finished all real questions." });
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

  it("imports example course JSON and resets demo progress", async () => {
    await renderSidebar();

    await page.getByRole("button", { name: "Import course", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import course" });
    await expect.element(dialog).toBeInTheDocument();
    await expect
      .element(dialog.getByRole("button", { name: "Open folder", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(dialog.getByRole("button", { name: "Check priorities", exact: true }))
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
});
