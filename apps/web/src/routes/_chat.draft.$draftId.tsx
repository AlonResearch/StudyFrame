import { createFileRoute } from "@tanstack/react-router";

import { StudyWorkspace } from "~/components/study/StudyWorkspace";

export const Route = createFileRoute("/_chat/draft/$draftId")({
  component: StudyWorkspace,
});
