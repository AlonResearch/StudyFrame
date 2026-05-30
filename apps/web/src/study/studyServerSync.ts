import type { StudyFrameSnapshot, StudyFrameSnapshotResponse } from "@t3tools/contracts";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { withDerivedStudyDomainModel } from "./studyDomainModel";
import { getNextRealQuestion } from "./studyLogic";
import { useStudyFrameStore, type StudyFrameStoreState } from "./studyStore";

let installed = false;
let saveTimer: number | undefined;
let lastSavedJson = "";

function makeSnapshot(state: StudyFrameStoreState): StudyFrameSnapshot {
  return {
    dataset: withDerivedStudyDomainModel(state.dataset),
    attempts: state.attempts,
    completionSummaries: state.completionSummaries,
    generatedQuestionBatches: state.generatedQuestionBatches,
  };
}

function initialSelectedTopicThreadId(snapshot: StudyFrameSnapshot) {
  return (
    [...snapshot.dataset.topicThreads].sort(
      (left, right) => right.priorityScore - left.priorityScore,
    )[0]?.id ?? null
  );
}

function applyServerSnapshot(snapshot: StudyFrameSnapshot) {
  const current = useStudyFrameStore.getState();
  const dataset = withDerivedStudyDomainModel(snapshot.dataset);
  const selectedProjectId =
    dataset.projects.find((project) => project.id === current.selectedProjectId)?.id ??
    dataset.projects[0]?.id ??
    "";
  const selectedTopicThreadId =
    dataset.topicThreads.find((thread) => thread.id === current.selectedTopicThreadId)?.id ??
    initialSelectedTopicThreadId({ ...snapshot, dataset });
  const activeQuestionId =
    dataset.questions.find((question) => question.id === current.activeQuestionId)?.id ??
    (selectedTopicThreadId
      ? (getNextRealQuestion(dataset, snapshot.attempts, selectedTopicThreadId)?.id ?? null)
      : null);

  useStudyFrameStore.setState({
    dataset,
    attempts: snapshot.attempts,
    completionSummaries: snapshot.completionSummaries,
    generatedQuestionBatches: snapshot.generatedQuestionBatches,
    selectedProjectId,
    selectedTopicThreadId,
    activeQuestionId,
    exhaustionSummaryId: null,
    reviewModeTopicThreadId: null,
  });
}

async function loadStudyFrameSnapshot(): Promise<StudyFrameSnapshot | null> {
  const response = await fetch(resolvePrimaryEnvironmentHttpUrl("/api/studyframe/snapshot"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`StudyFrame snapshot load failed with HTTP ${response.status}`);
  }
  const payload = (await response.json()) as StudyFrameSnapshotResponse;
  return payload.snapshot;
}

async function saveStudyFrameSnapshot(snapshot: StudyFrameSnapshot): Promise<void> {
  const response = await fetch(resolvePrimaryEnvironmentHttpUrl("/api/studyframe/snapshot"), {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    throw new Error(`StudyFrame snapshot save failed with HTTP ${response.status}`);
  }
}

function scheduleSave(snapshot: StudyFrameSnapshot) {
  const nextJson = JSON.stringify(snapshot);
  if (nextJson === lastSavedJson) return;

  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    void saveStudyFrameSnapshot(snapshot)
      .then(() => {
        lastSavedJson = nextJson;
      })
      .catch((error: unknown) => {
        console.warn(error);
      });
  }, 350);
}

export function installStudyFrameServerSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  void loadStudyFrameSnapshot()
    .then((snapshot) => {
      if (snapshot) {
        lastSavedJson = JSON.stringify(snapshot);
        applyServerSnapshot(snapshot);
      } else {
        const currentSnapshot = makeSnapshot(useStudyFrameStore.getState());
        lastSavedJson = JSON.stringify(currentSnapshot);
        void saveStudyFrameSnapshot(currentSnapshot).catch((error: unknown) => {
          console.warn(error);
        });
      }
    })
    .catch((error: unknown) => {
      console.warn(error);
    })
    .finally(() => {
      useStudyFrameStore.subscribe((state) => {
        scheduleSave(makeSnapshot(state));
      });
    });
}
