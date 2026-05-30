import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { SidebarProvider } from "~/components/ui/sidebar";
import { studySeedData } from "~/study/studySeedData";
import { useStudyFrameStore } from "~/study/studyStore";
import { StudyWorkspace } from "./StudyWorkspace";

vi.mock("~/study/studyServerSync", () => ({
  installStudyFrameServerSync: () => () => {},
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
  });

  it("keeps real-question answers hidden until reveal", async () => {
    mounted = await render(
      <SidebarProvider>
        <StudyWorkspace />
      </SidebarProvider>,
    );

    await expect
      .element(page.getByRole("heading", { name: "Spike-train statistics", exact: true }))
      .toBeInTheDocument();
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
});
