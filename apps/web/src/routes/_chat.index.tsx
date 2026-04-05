import { createFileRoute } from "@tanstack/react-router";

import { ChatHomeEmptyState } from "../components/home/ChatHomeEmptyState";

function ChatIndexRouteView() {
  return <ChatHomeEmptyState />;
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
