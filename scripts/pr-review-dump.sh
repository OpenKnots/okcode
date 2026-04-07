#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PR Review Dump — Non-interactive JSON dump of unresolved PR review threads
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Usage:
#   ./scripts/pr-review-dump.sh [PR_NUMBER] [--resolved] [--all]
#
# Options:
#   --resolved   Include resolved threads too
#   --all        Show all threads (resolved + unresolved)
#   --with-code  Include surrounding code context in output
#   --summary    Show only a summary table, no JSON
#
# If PR_NUMBER is omitted, auto-detects from the current branch.
# Output is structured JSON suitable for piping to jq or processing by agents.
#
# Dependencies: gh (GitHub CLI), jq
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# ── Parse args ───────────────────────────────────────────────────────────────
SHOW_RESOLVED=false
SHOW_ALL=false
WITH_CODE=false
SUMMARY_MODE=false
PR_NUMBER=""

for arg in "$@"; do
  case "$arg" in
    --resolved) SHOW_RESOLVED=true ;;
    --all) SHOW_ALL=true ;;
    --with-code) WITH_CODE=true ;;
    --summary) SUMMARY_MODE=true ;;
    --help|-h)
      sed -n '2,/^$/p' "$0" | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *)
      if [[ "$arg" =~ ^[0-9]+$ ]]; then
        PR_NUMBER="$arg"
      fi
      ;;
  esac
done

# ── Preflight ────────────────────────────────────────────────────────────────
command -v gh >/dev/null 2>&1 || { echo "Error: 'gh' is required" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Error: 'jq' is required" >&2; exit 1; }

REMOTE_URL=$(git remote get-url origin 2>/dev/null || { echo "Error: Not a git repo" >&2; exit 1; })
if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]}"
else
  echo "Error: Could not parse owner/repo from: $REMOTE_URL" >&2
  exit 1
fi

if [[ -z "$PR_NUMBER" ]]; then
  BRANCH=$(git branch --show-current 2>/dev/null || { echo "Error: Not on a branch" >&2; exit 1; })
  PR_NUMBER=$(gh pr view "$BRANCH" --json number -q '.number' 2>/dev/null || true)
  if [[ -z "$PR_NUMBER" ]]; then
    echo "Error: No PR found for branch '$BRANCH'" >&2
    exit 1
  fi
fi

# ── Fetch PR metadata ───────────────────────────────────────────────────────
PR_META=$(gh api graphql -f query='
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      title
      number
      url
      state
      headRefName
      baseRefName
      author { login }
    }
  }
}' -f owner="$OWNER" -f repo="$REPO" -F pr="$PR_NUMBER" \
  | jq '.data.repository.pullRequest')

# ── Fetch review threads (paginated) ────────────────────────────────────────
ALL_THREADS="[]"
HAS_NEXT="true"
CURSOR="null"

while [[ "$HAS_NEXT" == "true" ]]; do
  RESULT=$(gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            startLine
            diffSide
            comments(first: 50) {
              nodes {
                id
                databaseId
                body
                author { login }
                createdAt
                url
              }
            }
          }
        }
      }
    }
  }' -f owner="$OWNER" -f repo="$REPO" -F pr="$PR_NUMBER" \
     -f cursor="$CURSOR" 2>/dev/null)

  PAGE=$(echo "$RESULT" | jq '.data.repository.pullRequest.reviewThreads.nodes')
  ALL_THREADS=$(echo "$ALL_THREADS" "$PAGE" | jq -s '.[0] + .[1]')

  HAS_NEXT=$(echo "$RESULT" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')
  CURSOR=$(echo "$RESULT" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')
done

# ── Filter threads ───────────────────────────────────────────────────────────
if [[ "$SHOW_ALL" == "true" ]]; then
  FILTERED="$ALL_THREADS"
elif [[ "$SHOW_RESOLVED" == "true" ]]; then
  FILTERED=$(echo "$ALL_THREADS" | jq '[.[] | select(.isResolved == true)]')
else
  FILTERED=$(echo "$ALL_THREADS" | jq '[.[] | select(.isResolved == false)]')
fi

# ── Optionally embed code context ────────────────────────────────────────────
if [[ "$WITH_CODE" == "true" ]]; then
  ENRICHED="[]"
  COUNT=$(echo "$FILTERED" | jq 'length')
  for (( i=0; i<COUNT; i++ )); do
    THREAD=$(echo "$FILTERED" | jq ".[$i]")
    PATH_VAL=$(echo "$THREAD" | jq -r '.path')
    LINE_VAL=$(echo "$THREAD" | jq -r '.line // empty')

    CODE_CONTEXT="null"
    if [[ -f "$PATH_VAL" && -n "$LINE_VAL" && "$LINE_VAL" != "null" ]]; then
      START=$((LINE_VAL > 5 ? LINE_VAL - 5 : 1))
      END=$((LINE_VAL + 5))
      CODE_CONTEXT=$(sed -n "${START},${END}p" "$PATH_VAL" | jq -Rs '.')
    fi

    THREAD=$(echo "$THREAD" | jq --argjson code "$CODE_CONTEXT" '. + {codeContext: $code}')
    ENRICHED=$(echo "$ENRICHED" | jq --argjson t "$THREAD" '. + [$t]')
  done
  FILTERED="$ENRICHED"
fi

# ── Output ───────────────────────────────────────────────────────────────────
TOTAL=$(echo "$ALL_THREADS" | jq 'length')
UNRESOLVED=$(echo "$ALL_THREADS" | jq '[.[] | select(.isResolved == false)] | length')
RESOLVED=$((TOTAL - UNRESOLVED))
SHOWN=$(echo "$FILTERED" | jq 'length')

if [[ "$SUMMARY_MODE" == "true" ]]; then
  # ── Summary table mode ──────────────────────────────────────────────
  PR_TITLE=$(echo "$PR_META" | jq -r '.title')
  PR_URL=$(echo "$PR_META" | jq -r '.url')

  echo ""
  echo "PR #$PR_NUMBER — $PR_TITLE"
  echo "$PR_URL"
  echo ""
  printf "Total: %d  |  Unresolved: %d  |  Resolved: %d\n" "$TOTAL" "$UNRESOLVED" "$RESOLVED"
  echo ""
  printf "%-4s %-8s %-8s %-40s %-6s %-15s %s\n" "#" "Status" "Outdated" "File" "Line" "Author" "Comment (truncated)"
  printf "%-4s %-8s %-8s %-40s %-6s %-15s %s\n" "---" "--------" "--------" "----------------------------------------" "------" "---------------" "----------------------------"

  IDX=0
  echo "$FILTERED" | jq -c '.[]' | while IFS= read -r thread; do
    IDX=$((IDX + 1))
    is_resolved=$(echo "$thread" | jq -r '.isResolved')
    is_outdated=$(echo "$thread" | jq -r '.isOutdated')
    path=$(echo "$thread" | jq -r '.path')
    line=$(echo "$thread" | jq -r '.line // "?"')
    author=$(echo "$thread" | jq -r '.comments.nodes[0].author.login // "ghost"')
    body=$(echo "$thread" | jq -r '.comments.nodes[0].body' | tr '\n' ' ' | cut -c1-60)

    status="OPEN"
    [[ "$is_resolved" == "true" ]] && status="RESOLVED"
    outdated="no"
    [[ "$is_outdated" == "true" ]] && outdated="yes"

    printf "%-4s %-8s %-8s %-40s %-6s %-15s %s\n" \
      "$IDX" "$status" "$outdated" "${path:0:40}" "$line" "$author" "$body"
  done

  echo ""
else
  # ── JSON mode ───────────────────────────────────────────────────────
  jq -n \
    --argjson pr "$PR_META" \
    --argjson threads "$FILTERED" \
    --argjson total "$TOTAL" \
    --argjson unresolved "$UNRESOLVED" \
    --argjson resolved "$RESOLVED" \
    --argjson shown "$SHOWN" \
    '{
      pr: $pr,
      stats: {
        total: $total,
        unresolved: $unresolved,
        resolved: $resolved,
        shown: $shown
      },
      threads: $threads
    }'
fi
