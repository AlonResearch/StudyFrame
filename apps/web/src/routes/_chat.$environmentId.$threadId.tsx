import { createFileRoute } from "@tanstack/react-router";

import { StudyWorkspace } from "~/components/study/StudyWorkspace";

export const Route = createFileRoute("/_chat/$environmentId/$threadId")({
  component: StudyWorkspace,
});
