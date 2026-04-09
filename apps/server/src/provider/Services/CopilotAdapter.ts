import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface CopilotAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "copilot";
}

export class CopilotAdapter extends ServiceMap.Service<CopilotAdapter, CopilotAdapterShape>()(
  "okcode/provider/Services/CopilotAdapter",
) {}
