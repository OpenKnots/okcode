import { CircleAlertIcon, MessageSquareReplyIcon } from "lucide-react";
import { memo } from "react";
import { type ServerProviderStatus } from "@okcode/contracts";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { type PendingApproval, type PendingUserInput } from "../../session-logic";

function summarizeApproval(approval: PendingApproval): string {
  return approval.requestKind === "command"
    ? "Command approval requested"
    : approval.requestKind === "file-read"
      ? "File-read approval requested"
      : "File-change approval requested";
}

export const MobileThreadAttentionBar = memo(function MobileThreadAttentionBar({
  activePendingApproval,
  activePendingUserInput,
  hasPlanReady,
  providerStatus,
  onReview,
}: {
  activePendingApproval: PendingApproval | null;
  activePendingUserInput: PendingUserInput | null;
  hasPlanReady: boolean;
  providerStatus: ServerProviderStatus | null;
  onReview: () => void;
}) {
  if (activePendingApproval) {
    return (
      <Alert variant="warning" className="rounded-2xl">
        <CircleAlertIcon />
        <AlertTitle>{summarizeApproval(activePendingApproval)}</AlertTitle>
        <AlertDescription>
          Review the request and respond from the composer to unblock the agent.
        </AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" type="button" onClick={onReview}>
            Review
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (activePendingUserInput) {
    return (
      <Alert variant="info" className="rounded-2xl">
        <MessageSquareReplyIcon />
        <AlertTitle>User input requested</AlertTitle>
        <AlertDescription>
          Answer the current prompt from the composer to keep the turn moving.
        </AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" type="button" onClick={onReview}>
            Answer
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (hasPlanReady) {
    return (
      <Alert variant="info" className="rounded-2xl">
        <MessageSquareReplyIcon />
        <AlertTitle>Plan ready for follow-up</AlertTitle>
        <AlertDescription>
          Refine the plan or implement it from the composer actions below.
        </AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" type="button" onClick={onReview}>
            Review
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (providerStatus && providerStatus.status !== "ready") {
    return (
      <Alert
        variant={providerStatus.status === "error" ? "error" : "warning"}
        className="rounded-2xl"
      >
        <CircleAlertIcon />
        <AlertTitle>Provider needs attention</AlertTitle>
        <AlertDescription>
          {providerStatus.message ??
            "The selected provider is degraded. The thread may pause until the provider recovers."}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
});
