export const PROMPT_ENHANCEMENT_IDS = [
  "specificity",
  "clarity",
  "constraints",
  "examples",
  "testing",
  "reasoning",
] as const;

export type PromptEnhancementId = (typeof PROMPT_ENHANCEMENT_IDS)[number];

export interface PromptEnhancementDefinition {
  id: PromptEnhancementId;
  label: string;
  description: string;
  guidance: readonly string[];
}

export const PROMPT_ENHANCEMENTS: readonly PromptEnhancementDefinition[] = [
  {
    id: "specificity",
    label: "Add specificity",
    description: "Add concrete details and constraints",
    guidance: [
      "Add concrete file paths, function names, variables, or UI surfaces when they are implied by the request.",
      "Replace vague language with exact expected behavior or outcomes.",
      "Preserve the user's underlying task instead of inventing new scope.",
    ],
  },
  {
    id: "clarity",
    label: "Improve clarity",
    description: "Restructure for clearer communication",
    guidance: [
      "Rewrite the request into a clearer, more direct instruction before acting on it.",
      "Resolve ambiguous phrasing where the intent is already apparent from context.",
      "Keep the request concise and easy to execute.",
    ],
  },
  {
    id: "constraints",
    label: "Define constraints",
    description: "Add boundaries and requirements",
    guidance: [
      "Surface reasonable boundaries, invariants, and compatibility expectations that are already implied by the request.",
      "Favor minimal, focused changes over broad rewrites unless the user explicitly asks for more.",
      "Do not invent arbitrary restrictions that would distort the original intent.",
    ],
  },
  {
    id: "examples",
    label: "Request examples",
    description: "Ask for usage examples and edge cases",
    guidance: [
      "Interpret the request with likely examples, edge cases, or before/after behavior in mind.",
      "Only surface examples explicitly in the response when they materially help solve the task.",
      "Do not turn this into a separate documentation task unless the user is asking for that.",
    ],
  },
  {
    id: "testing",
    label: "Include testing",
    description: "Add testing expectations",
    guidance: [
      "Treat validation and relevant test coverage as part of a complete solution when applicable.",
      "Focus on the most meaningful happy-path and edge-case checks for the request.",
      "Do not force tests where they would be irrelevant or impossible in context.",
    ],
  },
  {
    id: "reasoning",
    label: "Ask for reasoning",
    description: "Request explanation of decisions",
    guidance: [
      "Be prepared to explain the chosen approach, tradeoffs, and notable risks when useful.",
      "Keep the explanation proportional to the task instead of turning it into a long essay.",
      "Treat reasoning as support for the task, not as a separate deliverable unless the user asks for depth.",
    ],
  },
];

const PROMPT_ENHANCEMENT_BY_ID = new Map(
  PROMPT_ENHANCEMENTS.map((enhancement) => [enhancement.id, enhancement]),
);

export function isPromptEnhancementId(value: unknown): value is PromptEnhancementId {
  return (
    typeof value === "string" &&
    (PROMPT_ENHANCEMENT_IDS as readonly string[]).includes(value)
  );
}

export function getPromptEnhancementById(
  id: PromptEnhancementId | null | undefined,
): PromptEnhancementDefinition | null {
  if (!id) {
    return null;
  }
  return PROMPT_ENHANCEMENT_BY_ID.get(id) ?? null;
}

export function buildEnhancedPromptInput(
  prompt: string,
  enhancementId: PromptEnhancementId | null | undefined,
): string {
  const trimmedPrompt = prompt.trim();
  if (!enhancementId || trimmedPrompt.length === 0) {
    return trimmedPrompt;
  }

  const enhancement = getPromptEnhancementById(enhancementId);
  if (!enhancement) {
    return trimmedPrompt;
  }

  return [
    `Before responding, improve the user's request using the "${enhancement.label}" enhancement mode, then follow the improved request.`,
    "",
    "Use this guidance while refining the request internally:",
    ...enhancement.guidance.map((item) => `- ${item}`),
    "",
    "Preserve the user's intent. Treat this as prompt improvement, not as a separate checklist or extra task to complete independently.",
    "",
    "User request:",
    trimmedPrompt,
  ].join("\n");
}
