import { createFileRoute } from "@tanstack/react-router";

import { StudyWorkspace } from "../components/study/StudyWorkspace";

function ChatIndexRouteView() {
  return <StudyWorkspace />;
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
