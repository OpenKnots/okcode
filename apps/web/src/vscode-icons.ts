import vscodeIconsLookupData from "./vscode-icons-lookup.json";
import languageAssociationsData from "./vscode-icons-language-associations.json";

const VSCODE_ICONS_VERSION = "v12.17.0";
const VSCODE_ICONS_BASE_URL = `https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons@${VSCODE_ICONS_VERSION}/icons`;

interface VscodeIconLookup {
  version: string;
  generatedAt: string;
  defaults: {
    darkFile: string;
    lightFile: string;
    darkFolder: string;
    lightFolder: string;
  };
  lightFileNames: Record<string, string>;
  darkFileNames: Record<string, string>;
  lightFileExtensions: Record<string, string>;
  darkFileExtensions: Record<string, string>;
  lightFolderNames: Record<string, string>;
  darkFolderNames: Record<string, string>;
  lightLanguageIds: Record<string, string>;
  darkLanguageIds: Record<string, string>;
}

interface LanguageAssociations {
  version: string;
  extensionToLanguageId: Record<string, string>;
  fileNameToLanguageId: Record<string, string>;
}

const iconLookup = vscodeIconsLookupData as VscodeIconLookup;
const languageAssociations = languageAssociationsData as LanguageAssociations;

const darkFileNames = iconLookup.darkFileNames;
const lightFileNames = iconLookup.lightFileNames;
const darkFileExtensions = iconLookup.darkFileExtensions;
const lightFileExtensions = iconLookup.lightFileExtensions;
const darkFolderNames = iconLookup.darkFolderNames;
const lightFolderNames = iconLookup.lightFolderNames;
const darkLanguageIds = iconLookup.darkLanguageIds;
const lightLanguageIds = iconLookup.lightLanguageIds;
const languageIdByExtension = toLowercaseLookup(languageAssociations.extensionToLanguageId);
const languageIdByFileName = toLowercaseLookup(languageAssociations.fileNameToLanguageId);
const localLanguageIdByExtensionOverrides = {
  // Cursor rules files (*.mdc) are commonly treated as markdown in VSCode/Cursor.
  mdc: "markdown",
  // Upstream languages.ts currently maps .html to django-html before html.
  // Prefer the base HTML icon for standalone HTML files.
  html: "html",
  // Upstream languages.ts maps yml/yaml to specialized language ids that can produce
  // non-generic YAML icons (for example cloudfoundry/esphome). Prefer the base YAML icon
  // unless a more specific basename/extension match (e.g. azure-pipelines.yml) is found.
  yml: "yaml",
  yaml: "yaml",
} as const;

const defaultDarkFileIconFilename = iconLookup.defaults.darkFile;
const defaultLightFileIconFilename = iconLookup.defaults.lightFile;
const defaultDarkFolderIconFilename = iconLookup.defaults.darkFolder;
const defaultLightFolderIconFilename = iconLookup.defaults.lightFolder;

function toLowercaseLookup(source: Record<string, string>): Record<string, string> {
  const entries = Object.entries(source);
  const lookup: Record<string, string> = {};
  for (const [key, value] of entries) {
    lookup[key.toLowerCase()] = value;
  }
  return lookup;
}

export function basenameOfPath(pathValue: string): string {
  const slashIndex = pathValue.lastIndexOf("/");
  if (slashIndex === -1) return pathValue;
  return pathValue.slice(slashIndex + 1);
}

export function inferEntryKindFromPath(pathValue: string): "file" | "directory" {
  const base = basenameOfPath(pathValue);
  if (base.startsWith(".") && !base.slice(1).includes(".")) {
    return "directory";
  }
  if (base.includes(".")) {
    return "file";
  }
  return "directory";
}

function extensionCandidates(fileName: string): string[] {
  const candidates = new Set<string>();
  if (fileName.includes(".")) {
    candidates.add(fileName);
  }
  let dotIndex = fileName.indexOf(".");
  while (dotIndex !== -1 && dotIndex < fileName.length - 1) {
    const candidate = fileName.slice(dotIndex + 1);
    if (candidate.length > 0) {
      candidates.add(candidate);
    }
    dotIndex = fileName.indexOf(".", dotIndex + 1);
  }
  return [...candidates];
}

function resolveLanguageFallbackDefinition(
  pathValue: string,
  theme: "light" | "dark",
): string | null {
  const languageId = inferLanguageIdForPath(pathValue);
  if (!languageId) return null;

  const languageIds = theme === "light" ? lightLanguageIds : darkLanguageIds;
  return languageIds[languageId] ?? darkLanguageIds[languageId] ?? null;
}

export function inferLanguageIdForPath(pathValue: string): string | null {
  const basename = basenameOfPath(pathValue).toLowerCase();

  const fromBasenameLanguage = languageIdByFileName[basename];
  if (fromBasenameLanguage) {
    return fromBasenameLanguage;
  }

  for (const candidate of extensionCandidates(basename)) {
    const languageId =
      localLanguageIdByExtensionOverrides[
        candidate as keyof typeof localLanguageIdByExtensionOverrides
      ] ?? languageIdByExtension[candidate];
    if (languageId) return languageId;
  }

  return null;
}

function resolveFileIconFilename(pathValue: string, theme: "light" | "dark"): string {
  const basename = basenameOfPath(pathValue).toLowerCase();
  const fileNames = theme === "light" ? lightFileNames : darkFileNames;
  const fileExtensions = theme === "light" ? lightFileExtensions : darkFileExtensions;

  const fromFileName = fileNames[basename] ?? darkFileNames[basename];
  if (fromFileName) return fromFileName;

  for (const candidate of extensionCandidates(basename)) {
    const fromExtension = fileExtensions[candidate] ?? darkFileExtensions[candidate];
    if (fromExtension) return fromExtension;
  }

  const fromLanguage = resolveLanguageFallbackDefinition(pathValue, theme);
  if (fromLanguage) return fromLanguage;

  return theme === "light" ? defaultLightFileIconFilename : defaultDarkFileIconFilename;
}

function resolveFolderIconFilename(pathValue: string, theme: "light" | "dark"): string {
  const basename = basenameOfPath(pathValue).toLowerCase();
  const folderNames = theme === "light" ? lightFolderNames : darkFolderNames;
  return (
    folderNames[basename] ??
    darkFolderNames[basename] ??
    (theme === "light" ? defaultLightFolderIconFilename : defaultDarkFolderIconFilename)
  );
}

export function getVscodeIconUrlForEntry(
  pathValue: string,
  kind: "file" | "directory",
  theme: "light" | "dark",
): string {
  const iconFilename =
    kind === "directory"
      ? resolveFolderIconFilename(pathValue, theme)
      : resolveFileIconFilename(pathValue, theme);
  return `${VSCODE_ICONS_BASE_URL}/${iconFilename}`;
}
