import { EditorState, type Extension, Compartment } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  type ViewUpdate,
} from "@codemirror/view";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  LanguageDescription,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { memo, useEffect, useRef } from "react";
import { isMacPlatform } from "~/lib/utils";

export interface CodeContextSelection {
  filePath: string;
  fromLine: number;
  toLine: number;
}

const themeCompartment = new Compartment();
const languageCompartment = new Compartment();
const keymapCompartment = new Compartment();
const editableCompartment = new Compartment();
const updateListenerCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wordWrapCompartment = new Compartment();

const baseExtensions: Extension[] = [
  highlightActiveLine(),
  highlightSpecialChars(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "var(--font-size-code, 12px)",
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
    ".cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--primary) 55%, transparent) !important",
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

function buildEditorKeymap(
  filePath: string,
  onAddContext: (ctx: CodeContextSelection) => void,
  onSave?: () => void,
): Extension {
  const bindings = [
    {
      key: isMacPlatform(navigator.platform) ? "Mod-l" : "Ctrl-l",
      run: (view: EditorView) => {
        const { from, to } = view.state.selection.main;
        if (from === to) return false;
        const fromLine = view.state.doc.lineAt(from).number;
        const toLine = view.state.doc.lineAt(to).number;
        onAddContext({ filePath, fromLine, toLine });
        return true;
      },
    },
  ];
  if (onSave) {
    bindings.unshift({
      key: "Mod-s",
      run: () => {
        onSave();
        return true;
      },
    });
  }
  return keymap.of(bindings);
}

function buildEditableExtension(editable: boolean): Extension {
  return [EditorView.editable.of(editable), EditorState.readOnly.of(!editable)];
}

function buildUpdateListener(editable: boolean, onChange?: (contents: string) => void): Extension {
  if (!editable || !onChange) {
    return [];
  }
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString());
    }
  });
}

export const CodeMirrorViewer = memo(function CodeMirrorViewer(props: {
  contents: string;
  filePath: string;
  resolvedTheme: "light" | "dark";
  editable?: boolean;
  onChange?: (contents: string) => void;
  onSave?: () => void;
  onAddContext?: (ctx: CodeContextSelection) => void;
  showLineNumbers?: boolean;
  wordWrap?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const filePathRef = useRef<string | null>(null);
  const onAddContextRef = useRef(props.onAddContext);
  const onChangeRef = useRef(props.onChange);
  const onSaveRef = useRef(props.onSave);
  onAddContextRef.current = props.onAddContext;
  onChangeRef.current = props.onChange;
  onSaveRef.current = props.onSave;

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const editorKeymap = buildEditorKeymap(
      props.filePath,
      (ctx) => {
        onAddContextRef.current?.(ctx);
      },
      () => {
        onSaveRef.current?.();
      },
    );
    const editable = props.editable ?? false;

    const state = EditorState.create({
      doc: props.contents,
      extensions: [
        ...baseExtensions,
        lineNumbersCompartment.of(props.showLineNumbers !== false ? lineNumbers() : []),
        wordWrapCompartment.of(props.wordWrap ? EditorView.lineWrapping : []),
        themeCompartment.of(getThemeExtension(props.resolvedTheme)),
        languageCompartment.of([]),
        keymapCompartment.of(editorKeymap),
        editableCompartment.of(buildEditableExtension(editable)),
        updateListenerCompartment.of(
          buildUpdateListener(editable, (contents) => {
            onChangeRef.current?.(contents);
          }),
        ),
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

  // Update editability and update listeners when it changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const editable = props.editable ?? false;
    view.dispatch({
      effects: [
        editableCompartment.reconfigure(buildEditableExtension(editable)),
        updateListenerCompartment.reconfigure(
          buildUpdateListener(editable, (contents) => {
            onChangeRef.current?.(contents);
          }),
        ),
      ],
    });
  }, [props.editable]);

  // Update language and keymap when file path or save behavior changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const nextKeymap = buildEditorKeymap(
      props.filePath,
      (ctx) => {
        onAddContextRef.current?.(ctx);
      },
      () => {
        onSaveRef.current?.();
      },
    );
    const effects = [keymapCompartment.reconfigure(nextKeymap)];
    if (filePathRef.current !== props.filePath) {
      filePathRef.current = props.filePath;
      void loadLanguageExtension(props.filePath).then((langExt) => {
        if (viewRef.current === view) {
          view.dispatch({
            effects: languageCompartment.reconfigure(langExt),
          });
        }
      });
    }
    view.dispatch({
      effects,
    });
  }, [props.filePath, props.onSave]);

  // Update line numbers when showLineNumbers changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: lineNumbersCompartment.reconfigure(
        props.showLineNumbers !== false ? lineNumbers() : [],
      ),
    });
  }, [props.showLineNumbers]);

  // Update word wrap when wordWrap changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wordWrapCompartment.reconfigure(
        props.wordWrap ? EditorView.lineWrapping : [],
      ),
    });
  }, [props.wordWrap]);

  return <div ref={containerRef} className="h-full min-h-0 overflow-hidden" />;
});
