import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { SidebarProvider } from "~/components/ui/sidebar";
import { studySeedData } from "~/study/studySeedData";
import { useStudyFrameStore } from "~/study/studyStore";
import { StudySidebar } from "./StudySidebar";
import { StudyWorkspace } from "./StudyWorkspace";

vi.mock("~/study/studyServerSync", () => ({
  installStudyFrameServerSync: () => () => {},
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { readonly children: React.ReactNode }) => <a>{children}</a>,
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

  it("shows the prioritized real-question workspace without leaking answers", async () => {
    await renderWorkspace();

    await expect
      .element(page.getByText("Topic priority", { exact: true }).first())
      .toBeInTheDocument();
    await expect.element(page.getByText("Theory summary", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByText("Real-question queue", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Spike-train statistics", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Quiz 2024 Q2", { exact: true }).first())
      .toBeInTheDocument();
    await expect
      .element(page.getByText("2024.pdf#page=3&q=2", { exact: true }).first())
      .toBeInTheDocument();
    await expect.element(page.getByText("96% confidence", { exact: true })).toBeInTheDocument();
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

    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await expect
      .element(page.getByText("Start by converting the observation window into seconds."))
      .toBeInTheDocument();
    await expect.element(page.getByText("16 Hz", { exact: true })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Reveal solution", exact: true }).click();
    await expect.element(page.getByText("Solution", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText(/16 Hz/).first()).toBeInTheDocument();
  });

  it("supports direction checks, submission feedback, and attempt history", async () => {
    await renderWorkspace();

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
      .toBeInTheDocument();
    await expect.element(page.getByText("Solution", { exact: true })).toBeInTheDocument();
  });

  it("unlocks generated practice only after all real questions are attempted", async () => {
    await renderWorkspace();

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
    await renderWorkspace();

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

    await page.getByRole("button", { name: "Topic priority", exact: true }).click();
    await page.getByRole("button", { name: "Score summary", exact: true }).click();
    await page.getByRole("button", { name: "Final report", exact: true }).click();
    await page.getByRole("button", { name: "Topic thread", exact: true }).click();
    await page.getByRole("button", { name: "Review material", exact: true }).click();
    await page.getByRole("button", { name: "Mistakes review", exact: true }).click();

    expect(clickSpy).toHaveBeenCalledTimes(6);
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

  it("imports example course JSON and resets demo progress", async () => {
    mounted = await render(
      <SidebarProvider>
        <StudySidebar />
      </SidebarProvider>,
    );

    await page.getByRole("button", { name: "Import course", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import course" });
    await expect.element(dialog).toBeInTheDocument();
    await dialog.getByRole("button", { name: "Example", exact: true }).click();
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await expect.element(page.getByText("Imported Course", { exact: true })).toBeInTheDocument();

    await page.getByRole("button", { name: "Reset demo progress", exact: true }).click();
    await expect
      .element(page.getByText("Signal and Data Analysis", { exact: true }))
      .toBeInTheDocument();
  });
});
