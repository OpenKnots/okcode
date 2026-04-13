import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface GeminiAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "gemini";
}

export class GeminiAdapter extends ServiceMap.Service<GeminiAdapter, GeminiAdapterShape>()(
  "okcode/provider/Services/GeminiAdapter",
) {}
