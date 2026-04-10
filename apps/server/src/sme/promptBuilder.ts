interface SmePromptDocument {
  readonly title: string;
  readonly fileName: string;
  readonly contentText: string;
}

const SME_BASE_INSTRUCTIONS = [
  "You are a knowledgeable subject matter expert assistant.",
  "Provide direct, accurate, and helpful answers grounded in the supplied project knowledge when relevant.",
  "Stay conversational, explain tradeoffs clearly, and say when the reference material is incomplete.",
  "Do not request approvals, tools, or interactive workflows. Reply with plain assistant text only.",
].join(" ");

function renderDocuments(docs: ReadonlyArray<SmePromptDocument>): string {
  if (docs.length === 0) {
    return "";
  }

  return [
    "Reference documents:",
    ...docs.flatMap((doc) => [
      `<document title="${doc.title}" filename="${doc.fileName}">`,
      doc.contentText,
      "</document>",
    ]),
  ].join("\n");
}

function renderHistory(
  history: ReadonlyArray<{ readonly role: string; readonly text: string }>,
): string {
  if (history.length === 0) {
    return "Conversation history:\n<empty>";
  }

  return [
    "Conversation history:",
    ...history
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => `${message.role.toUpperCase()}: ${message.text}`),
  ].join("\n");
}

export function buildSmeSystemPrompt(docs: ReadonlyArray<SmePromptDocument>): string {
  const sections = [SME_BASE_INSTRUCTIONS];
  const renderedDocs = renderDocuments(docs);
  if (renderedDocs.length > 0) {
    sections.push(renderedDocs);
  }
  return sections.join("\n\n");
}

export function buildSmeCompiledPrompt(input: {
  readonly docs: ReadonlyArray<SmePromptDocument>;
  readonly history: ReadonlyArray<{ readonly role: string; readonly text: string }>;
  readonly userText: string;
}): string {
  return [
    SME_BASE_INSTRUCTIONS,
    renderDocuments(input.docs),
    renderHistory(input.history),
    `Latest user message:\nUSER: ${input.userText}`,
    "Respond with the assistant reply only.",
  ]
    .filter((section) => section.length > 0)
    .join("\n\n");
}
