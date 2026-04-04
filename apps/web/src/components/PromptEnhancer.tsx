import { useCallback, useState } from "react";
import { SparklesIcon, CheckIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger, MenuSeparator, MenuGroupLabel } from "./ui/menu";

// ────────────────────────────────────────────────────────────────────────────
// Prompt Enhancement Presets
// ────────────────────────────────────────────────────────────────────────────

export interface PromptEnhancement {
  id: string;
  label: string;
  description: string;
  transform: (prompt: string) => string;
}

const ENHANCEMENTS: PromptEnhancement[] = [
  {
    id: "specificity",
    label: "Add specificity",
    description: "Add concrete details and constraints",
    transform: (prompt) =>
      `${prompt}\n\nBe specific: include concrete file paths, function names, variable names, and exact expected behavior. Avoid vague language.`,
  },
  {
    id: "clarity",
    label: "Improve clarity",
    description: "Restructure for clearer communication",
    transform: (prompt) =>
      `${prompt}\n\nPlease structure your response clearly with:\n1. A brief summary of what you'll do\n2. Step-by-step implementation\n3. Any assumptions you're making`,
  },
  {
    id: "constraints",
    label: "Define constraints",
    description: "Add boundaries and requirements",
    transform: (prompt) =>
      `${prompt}\n\nConstraints:\n- Do not modify existing tests unless necessary\n- Preserve backward compatibility\n- Follow existing code patterns and conventions in the codebase\n- Keep changes minimal and focused`,
  },
  {
    id: "examples",
    label: "Request examples",
    description: "Ask for usage examples and edge cases",
    transform: (prompt) =>
      `${prompt}\n\nInclude:\n- A usage example demonstrating the expected behavior\n- Edge cases to consider\n- Before/after comparison if modifying existing code`,
  },
  {
    id: "testing",
    label: "Include testing",
    description: "Add testing expectations",
    transform: (prompt) =>
      `${prompt}\n\nAlso:\n- Write or update relevant unit tests\n- Cover both happy path and error cases\n- Verify the implementation works by running the tests`,
  },
  {
    id: "reasoning",
    label: "Ask for reasoning",
    description: "Request explanation of decisions",
    transform: (prompt) =>
      `${prompt}\n\nBefore implementing, briefly explain:\n- Why you chose this approach over alternatives\n- Any trade-offs involved\n- Potential risks or things to watch out for`,
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

interface PromptEnhancerProps {
  prompt: string;
  onEnhance: (nextPrompt: string) => void;
  disabled?: boolean;
}

export default function PromptEnhancer({ prompt, onEnhance, disabled }: PromptEnhancerProps) {
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const handleEnhance = useCallback(
    (enhancement: PromptEnhancement) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;

      const nextPrompt = enhancement.transform(trimmed);
      onEnhance(nextPrompt);
      setAppliedIds((prev) => new Set(prev).add(enhancement.id));
    },
    [prompt, onEnhance],
  );

  const hasPrompt = prompt.trim().length > 0;

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            className="text-muted-foreground/70 hover:text-foreground/80"
            disabled={disabled || !hasPrompt}
            title="Enhance prompt"
            aria-label="Enhance prompt"
          />
        }
      >
        <SparklesIcon className="size-4" />
      </MenuTrigger>
      <MenuPopup align="end" side="top">
        <MenuGroupLabel>Enhance your prompt</MenuGroupLabel>
        <MenuSeparator />
        {ENHANCEMENTS.map((enhancement) => {
          const isApplied = appliedIds.has(enhancement.id);
          return (
            <MenuItem
              key={enhancement.id}
              onClick={() => handleEnhance(enhancement)}
              disabled={isApplied}
            >
              <div className="flex items-center gap-2">
                {isApplied ? (
                  <CheckIcon className="size-3.5 text-green-500" />
                ) : (
                  <span className="size-3.5" />
                )}
                <div className="flex flex-col">
                  <span>{enhancement.label}</span>
                  <span className="text-muted-foreground text-xs">{enhancement.description}</span>
                </div>
              </div>
            </MenuItem>
          );
        })}
      </MenuPopup>
    </Menu>
  );
}
