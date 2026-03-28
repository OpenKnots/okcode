import { WifiOffIcon, WifiIcon } from "lucide-react";
import { memo } from "react";

import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import type { TransportState } from "../../wsTransport";

export const CompanionConnectionBanner = memo(function CompanionConnectionBanner({
  state,
}: {
  state: TransportState;
}) {
  if (state === "open") {
    return null;
  }

  const content =
    state === "reconnecting"
      ? {
          title: "Reconnecting to OK Code",
          description:
            "Trying to restore the remote session. New actions will resume after reconnect.",
          icon: WifiOffIcon,
          variant: "warning" as const,
        }
      : state === "closed"
        ? {
            title: "Disconnected from OK Code",
            description:
              "The remote server is unavailable. Keep this thread open while the client retries.",
            icon: WifiOffIcon,
            variant: "error" as const,
          }
        : {
            title: "Connecting to OK Code",
            description: "Establishing the remote session connection.",
            icon: WifiIcon,
            variant: "info" as const,
          };

  const Icon = content.icon;
  return (
    <Alert variant={content.variant}>
      <Icon />
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription>{content.description}</AlertDescription>
    </Alert>
  );
});
