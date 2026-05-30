import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

function StudyFrameAuthenticatedLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/_chat")({
  beforeLoad: async ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: StudyFrameAuthenticatedLayout,
});
