/**
 * OpenClawAdapter - OpenClaw gateway implementation of the generic provider adapter contract.
 *
 * This service owns OpenClaw gateway/runtime session semantics and emits canonical
 * provider runtime events. It does not perform cross-provider routing, shared
 * event fan-out, or checkpoint orchestration.
 *
 * Uses Effect `ServiceMap.Service` for dependency injection and returns the
 * shared provider-adapter error channel with `provider: "openclaw"` context.
 *
 * @module OpenClawAdapter
 */
import { ServiceMap } from "effect";

import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

/**
 * OpenClawAdapterShape - Service API for the OpenClaw gateway provider adapter.
 */
export interface OpenClawAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {
  readonly provider: "openclaw";
}

/**
 * OpenClawAdapter - Service tag for OpenClaw gateway provider adapter operations.
 */
export class OpenClawAdapter extends ServiceMap.Service<OpenClawAdapter, OpenClawAdapterShape>()(
  "okcode/provider/Services/OpenClawAdapter",
) {}
