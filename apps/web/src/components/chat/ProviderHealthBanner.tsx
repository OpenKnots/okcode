import { type ServerProviderStatus } from "@okcode/contracts";
import { memo } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { CircleAlertIcon } from "lucide-react";
import {
  getProviderStatusDescription,
  getProviderStatusHeading,
} from "./providerStatusPresentation";

export const ProviderHealthBanner = memo(function ProviderHealthBanner({
  status,
}: {
  status: ServerProviderStatus | null;
}) {
  if (!status || status.status === "ready") {
    return null;
  }

  const title = getProviderStatusHeading(status);
  const description = getProviderStatusDescription(status);

  return (
    <div className="pt-3 mx-auto max-w-7xl">
      <Alert variant={status.status === "error" ? "error" : "warning"}>
        <CircleAlertIcon />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="line-clamp-3" title={description}>
          {description}
        </AlertDescription>
      </Alert>
    </div>
  );
});
