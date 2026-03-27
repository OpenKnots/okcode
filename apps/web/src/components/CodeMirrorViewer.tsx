import { EditorState, type Extension, Compartment } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightSpecialChars,
} from "@codemirror/view";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  LanguageDescription,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { memo, useEffect, useRef } from "react";

const themeCompartment = new Compartment();
const languageCompartment = new Compartment();

const baseExtensions: Extension[] = [
  lineNumbers(),
  highlightActiveLine(),
  highlightSpecialChars(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  EditorView.editable.of(false),
  EditorState.readOnly.of(true),
  EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "12px",
      backgroundColor: "var(--background)",
    },
    ".cm-scroller": {
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      overflow: "auto",
    },
    ".cm-gutters": {
      borderRight: "1px solid var(--border, #e5e7eb)",
      backgroundColor: "transparent",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 12px",
      minWidth: "3ch",
      color: "var(--muted-foreground, #6b7280)",
      opacity: "0.5",
      fontSize: "11px",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
    },
  }),
];

/** Use oneDark for syntax tokens but override its background so the editor
 *  blends with the app's own dark surface colour (`var(--background)`). */
function getThemeExtension(resolvedTheme: "light" | "dark"): Extension {
  if (resolvedTheme !== "dark") return [];
  return [
    oneDark,
    EditorView.theme(
      {
        "&.cm-editor": { backgroundColor: "var(--background)" },
        ".cm-gutters": { backgroundColor: "transparent" },
      },
      { dark: true },
    ),
  ];
}

async function loadLanguageExtension(filePath: string): Promise<Extension> {
  const languages = (await import("@codemirror/language-data")).languages;
  const match = LanguageDescription.matchFilename(languages, filePath);
  if (!match) return [];
  const support = await match.load();
  return support;
}

export const CodeMirrorViewer = memo(function CodeMirrorViewer(props: {
  contents: string;
  filePath: string;
  resolvedTheme: "light" | "dark";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const filePathRef = useRef<string | null>(null);

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: props.contents,
      extensions: [
        ...baseExtensions,
        themeCompartment.of(getThemeExtension(props.resolvedTheme)),
        languageCompartment.of([]),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Load language support asynchronously
    void loadLanguageExtension(props.filePath).then((langExt) => {
      if (viewRef.current === view) {
        view.dispatch({
          effects: languageCompartment.reconfigure(langExt),
        });
      }
    });
    filePathRef.current = props.filePath;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only re-create on mount/unmount — updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update contents when they change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== props.contents) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: props.contents },
      });
    }
  }, [props.contents]);

  // Update theme when it changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtension(props.resolvedTheme)),
    });
  }, [props.resolvedTheme]);

  // Update language when file path changes
  useEffect(() => {
    if (filePathRef.current === props.filePath) return;
    filePathRef.current = props.filePath;

    const view = viewRef.current;
    if (!view) return;

    void loadLanguageExtension(props.filePath).then((langExt) => {
      if (viewRef.current === view) {
        view.dispatch({
          effects: languageCompartment.reconfigure(langExt),
        });
      }
    });
  }, [props.filePath]);

  return <div ref={containerRef} className="h-full min-h-0 overflow-hidden" />;
});
