import { describe, expect, it } from "vitest";
import { parseGitHubRepositoryUrl } from "./githubRepositoryUrl";

describe("parseGitHubRepositoryUrl", () => {
  it("returns null for empty input", () => {
    expect(parseGitHubRepositoryUrl("")).toBeNull();
    expect(parseGitHubRepositoryUrl("  ")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseGitHubRepositoryUrl("not a url")).toBeNull();
    expect(parseGitHubRepositoryUrl("https://google.com")).toBeNull();
    expect(parseGitHubRepositoryUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("parses basic HTTPS URL", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/owner/repo");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: null,
    });
  });

  it("parses HTTPS URL with .git suffix", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/owner/repo.git");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: null,
    });
  });

  it("parses HTTPS URL with tree/branch path", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/owner/repo/tree/feature-branch");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: "feature-branch",
    });
  });

  it("parses HTTPS URL with tree/branch/path", () => {
    const result = parseGitHubRepositoryUrl(
      "https://github.com/owner/repo/tree/main/src/components",
    );
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: "main",
    });
  });

  it("parses HTTPS URL with blob path", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/owner/repo/blob/main/README.md");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: "main",
    });
  });

  it("parses SSH URL", () => {
    const result = parseGitHubRepositoryUrl("git@github.com:owner/repo.git");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: null,
    });
  });

  it("parses SSH URL without .git suffix", () => {
    const result = parseGitHubRepositoryUrl("git@github.com:owner/repo");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: null,
    });
  });

  it("parses owner/repo shorthand", () => {
    const result = parseGitHubRepositoryUrl("owner/repo");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: null,
    });
  });

  it("trims whitespace", () => {
    const result = parseGitHubRepositoryUrl("  https://github.com/owner/repo  ");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: null,
    });
  });

  it("handles URL with query params", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/owner/repo?tab=readme");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: null,
    });
  });

  it("handles URL with fragment", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/owner/repo#readme");
    expect(result).toEqual({
      cloneUrl: "https://github.com/owner/repo.git",
      owner: "owner",
      repo: "repo",
      branch: null,
    });
  });

  it("is case-insensitive for the domain", () => {
    const result = parseGitHubRepositoryUrl("https://GitHub.com/Owner/Repo");
    expect(result).toEqual({
      cloneUrl: "https://github.com/Owner/Repo.git",
      owner: "Owner",
      repo: "Repo",
      branch: null,
    });
  });

  it("handles repos with dots and hyphens", () => {
    const result = parseGitHubRepositoryUrl("https://github.com/my-org/my.repo-name");
    expect(result).toEqual({
      cloneUrl: "https://github.com/my-org/my.repo-name.git",
      owner: "my-org",
      repo: "my.repo-name",
      branch: null,
    });
  });

  it("handles shorthand with dots and hyphens", () => {
    const result = parseGitHubRepositoryUrl("my-org/my.repo");
    expect(result).toEqual({
      cloneUrl: "https://github.com/my-org/my.repo.git",
      owner: "my-org",
      repo: "my.repo",
      branch: null,
    });
  });
});
