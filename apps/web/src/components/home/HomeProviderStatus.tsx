import type { ServerProviderStatus } from "@okcode/contracts";

import { Badge } from "../ui/badge";
import { getProviderBadgeVariant, getProviderLabel, getProviderStatusLabel } from "./home-utils";

interface HomeProviderStatusProps {
  providers: ReadonlyArray<ServerProviderStatus>;
  onSettingsClick: () => void;
}

export function HomeProviderStatus({ providers, onSettingsClick }: HomeProviderStatusProps) {
  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Providers will appear after configuration loads.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {providers.map((provider) => {
        const variant = getProviderBadgeVariant(provider);
        const dotColor =
          variant === "success"
            ? "bg-emerald-500"
            : variant === "warning"
              ? "bg-amber-500"
              : "bg-red-500";

        return (
          <Badge
            key={provider.provider}
            variant={variant}
            render={<button type="button" onClick={onSettingsClick} />}
            className="cursor-pointer gap-1.5 px-2 py-0.5"
          >
            <span className={`size-1.5 rounded-full ${dotColor}`} />
            {getProviderLabel(provider.provider)}: {getProviderStatusLabel(provider)}
          </Badge>
        );
      })}
    </div>
  );
}
