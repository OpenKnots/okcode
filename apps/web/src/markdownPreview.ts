export const MARKDOWN_PREVIEW_CLASS_PREFIX = "okc-md-";
export const MARKDOWN_PREVIEW_WRAPPER_CLASS = `${MARKDOWN_PREVIEW_CLASS_PREFIX}preview`;

const MARKDOWN_FILE_EXTENSION_PATTERN = /\.(md|markdown|mdown|mkd)$/i;

export function isMarkdownPreviewFilePath(filePath: string): boolean {
  return MARKDOWN_FILE_EXTENSION_PATTERN.test(filePath);
}

export function scopeMarkdownPreviewThemeCss(themeCss: string): string {
  return themeCss
    .replaceAll(".cm-", `.${MARKDOWN_PREVIEW_CLASS_PREFIX}`)
    .replace(/(^|\n)code\s*\{/g, `$1.${MARKDOWN_PREVIEW_WRAPPER_CLASS} code {`);
}
