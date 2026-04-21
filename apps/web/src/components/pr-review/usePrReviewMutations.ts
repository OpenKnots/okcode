import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidatePrReviewQueries } from "~/lib/prReviewReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import { usePrReviewStore } from "~/prReviewStore";

/**
 * Centralizes all PR review mutations.
 * Reads `selectedPrNumber` from the Zustand store and handles cache invalidation.
 */
export function usePrReviewMutations(projectCwd: string) {
  const queryClient = useQueryClient();
  const selectedPrNumber = usePrReviewStore((s) => s.selectedPrNumber);

  const addThreadMutation = useMutation({
    mutationFn: async (input: { path: string; line: number; body: string }) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      return ensureNativeApi().prReview.addThread({
        cwd: projectCwd,
        prNumber: selectedPrNumber,
        path: input.path,
        line: input.line,
        body: input.body,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, projectCwd, selectedPrNumber);
    },
  });

  const replyToThreadMutation = useMutation({
    mutationFn: async (input: { threadId: string; body: string }) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      return ensureNativeApi().prReview.replyToThread({
        cwd: projectCwd,
        prNumber: selectedPrNumber,
        threadId: input.threadId,
        body: input.body,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, projectCwd, selectedPrNumber);
    },
  });

  const resolveThreadMutation = useMutation({
    mutationFn: async (input: { threadId: string; action: "resolve" | "unresolve" }) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      if (input.action === "resolve") {
        return ensureNativeApi().prReview.resolveThread({
          cwd: projectCwd,
          prNumber: selectedPrNumber,
          threadId: input.threadId,
        });
      }
      return ensureNativeApi().prReview.unresolveThread({
        cwd: projectCwd,
        prNumber: selectedPrNumber,
        threadId: input.threadId,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, projectCwd, selectedPrNumber);
    },
  });

  const runWorkflowStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      return ensureNativeApi().prReview.runWorkflowStep({
        cwd: projectCwd,
        prNumber: selectedPrNumber,
        stepId,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, projectCwd, selectedPrNumber);
    },
  });

  const applyConflictResolutionMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      const confirmed = await ensureNativeApi().dialogs.confirm(
        "Apply this conflict resolution candidate to the repository?",
      );
      if (!confirmed) return null;
      return ensureNativeApi().prReview.applyConflictResolution({
        cwd: projectCwd,
        prNumber: selectedPrNumber,
        candidateId,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, projectCwd, selectedPrNumber);
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (input: {
      event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
      body: string;
    }) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      return ensureNativeApi().prReview.submitReview({
        cwd: projectCwd,
        prNumber: selectedPrNumber,
        event: input.event,
        body: input.body,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      usePrReviewStore.getState().setReviewBody("");
      await invalidatePrReviewQueries(queryClient, projectCwd, selectedPrNumber);
    },
  });

  return {
    addThreadMutation,
    replyToThreadMutation,
    resolveThreadMutation,
    runWorkflowStepMutation,
    applyConflictResolutionMutation,
    submitReviewMutation,
  } as const;
}
