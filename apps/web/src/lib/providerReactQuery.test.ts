import { describe, expect, it } from "vitest";
import { ThreadId } from "@okcode/contracts";
import { providerQueryKeys, checkpointDiffQueryOptions } from "./providerReactQuery";

const threadId = ThreadId.makeUnsafe("thread-1");

describe("providerQueryKeys.checkpointDiff", () => {
  it("distinguishes patch and full-context file queries", () => {
    const patchKey = providerQueryKeys.checkpointDiff({
      threadId,
      fromTurnCount: 1,
      toTurnCount: 2,
      relativePath: "src/a.ts",
      contextMode: "patch",
    });
    const fullKey = providerQueryKeys.checkpointDiff({
      threadId,
      fromTurnCount: 1,
      toTurnCount: 2,
      relativePath: "src/a.ts",
      contextMode: "full",
    });

    expect(patchKey).not.toEqual(fullKey);
  });
});

describe("checkpointDiffQueryOptions", () => {
  it("stays enabled for full-thread file-scoped full-context queries", () => {
    const options = checkpointDiffQueryOptions({
      threadId,
      fromTurnCount: 0,
      toTurnCount: 2,
      relativePath: "src/a.ts",
      contextMode: "full",
    });

    expect(options.queryKey).toEqual(
      providerQueryKeys.checkpointDiff({
        threadId,
        fromTurnCount: 0,
        toTurnCount: 2,
        relativePath: "src/a.ts",
        contextMode: "full",
      }),
    );
    expect(options.enabled).toBe(true);
  });
});
