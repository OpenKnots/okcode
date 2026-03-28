import type { Project } from "~/types";

export function projectLabel(project: Project): string {
  return project.name.trim().length > 0 ? project.name : project.cwd;
}

export function joinPath(base: string, relativePath: string): string {
  return `${base.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;
}
