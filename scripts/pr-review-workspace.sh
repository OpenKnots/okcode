#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PR Review Workspace — Interactive unresolved-comment resolver
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Usage:
#   ./scripts/pr-review-workspace.sh [PR_NUMBER]
#
# If PR_NUMBER is omitted, auto-detects from the current branch.
#
# Dependencies: gh (GitHub CLI), jq
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# ── Colors & Symbols ─────────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
ITALIC='\033[3m'
UNDERLINE='\033[4m'
RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BG_RED='\033[41m'
BG_GREEN='\033[42m'
BG_BLUE='\033[44m'
BG_MAGENTA='\033[45m'
BG_CYAN='\033[46m'

SYM_CHECK="✓"
SYM_CROSS="✗"
SYM_ARROW="▸"
SYM_DOT="●"
SYM_CIRCLE="○"
SYM_FILE="📁"
SYM_USER="👤"
SYM_COMMENT="💬"
SYM_RESOLVED="✅"
SYM_PENDING="🔴"
SYM_OUTDATED="⚠️"
SYM_LINE="─"

# ── Temp files ───────────────────────────────────────────────────────────────
TMPDIR_WS=$(mktemp -d)
THREADS_JSON="$TMPDIR_WS/threads.json"
PR_JSON="$TMPDIR_WS/pr.json"
PROGRESS_FILE="$TMPDIR_WS/progress.json"
trap 'rm -rf "$TMPDIR_WS"' EXIT

# ── Utilities ────────────────────────────────────────────────────────────────
hr() {
  local cols
  cols=$(tput cols 2>/dev/null || echo 80)
  printf "${DIM}"
  printf '%*s' "$cols" '' | tr ' ' '━'
  printf "${RESET}\n"
}

hr_light() {
  local cols
  cols=$(tput cols 2>/dev/null || echo 80)
  printf "${DIM}"
  printf '%*s' "$cols" '' | tr ' ' '─'
  printf "${RESET}\n"
}

center() {
  local text="$1"
  local cols
  cols=$(tput cols 2>/dev/null || echo 80)
  local len=${#text}
  local pad=$(( (cols - len) / 2 ))
  printf '%*s%s\n' "$pad" '' "$text"
}

die() {
  printf "${RED}${BOLD}Error:${RESET} %s\n" "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed."
}

# ── Preflight ────────────────────────────────────────────────────────────────
require_cmd gh
require_cmd jq

# Determine owner/repo from git remote
REMOTE_URL=$(git remote get-url origin 2>/dev/null || die "Not a git repo or no 'origin' remote.")
if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]}"
else
  die "Could not parse owner/repo from remote URL: $REMOTE_URL"
fi

# Determine PR number
if [[ -n "${1:-}" ]]; then
  PR_NUMBER="$1"
else
  BRANCH=$(git branch --show-current 2>/dev/null || die "Could not determine current branch.")
  PR_NUMBER=$(gh pr view "$BRANCH" --json number -q '.number' 2>/dev/null || true)
  if [[ -z "$PR_NUMBER" ]]; then
    die "No PR found for branch '$BRANCH'. Pass a PR number explicitly: $0 <PR_NUMBER>"
  fi
fi

# ── Fetch PR metadata ───────────────────────────────────────────────────────
printf "${DIM}Fetching PR #%s metadata…${RESET}\n" "$PR_NUMBER"

gh api graphql -f query='
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
      additions
      deletions
      changedFiles
    }
  }
}' -f owner="$OWNER" -f repo="$REPO" -F pr="$PR_NUMBER" \
  | jq '.data.repository.pullRequest' > "$PR_JSON"

PR_TITLE=$(jq -r '.title' "$PR_JSON")
PR_URL=$(jq -r '.url' "$PR_JSON")
PR_STATE=$(jq -r '.state' "$PR_JSON")
PR_AUTHOR=$(jq -r '.author.login' "$PR_JSON")
PR_HEAD=$(jq -r '.headRefName' "$PR_JSON")
PR_BASE=$(jq -r '.baseRefName' "$PR_JSON")
PR_ADDS=$(jq -r '.additions' "$PR_JSON")
PR_DELS=$(jq -r '.deletions' "$PR_JSON")
PR_FILES=$(jq -r '.changedFiles' "$PR_JSON")

# ── Fetch ALL review threads (paginated) ────────────────────────────────────
printf "${DIM}Fetching review threads…${RESET}\n"

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

  PAGE_THREADS=$(echo "$RESULT" | jq '.data.repository.pullRequest.reviewThreads.nodes')
  ALL_THREADS=$(echo "$ALL_THREADS" "$PAGE_THREADS" | jq -s '.[0] + .[1]')

  HAS_NEXT=$(echo "$RESULT" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')
  CURSOR=$(echo "$RESULT" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')
done

# Filter to unresolved threads only
UNRESOLVED=$(echo "$ALL_THREADS" | jq '[.[] | select(.isResolved == false)]')
TOTAL_THREADS=$(echo "$ALL_THREADS" | jq 'length')
UNRESOLVED_COUNT=$(echo "$UNRESOLVED" | jq 'length')
RESOLVED_COUNT=$((TOTAL_THREADS - UNRESOLVED_COUNT))

echo "$UNRESOLVED" > "$THREADS_JSON"

# Initialize progress tracking
echo '{"resolved": [], "replied": [], "skipped": []}' > "$PROGRESS_FILE"

# ── Render Dashboard ─────────────────────────────────────────────────────────
render_dashboard() {
  clear
  echo ""
  hr
  printf "${BOLD}${CYAN}"
  center "PR REVIEW WORKSPACE"
  printf "${RESET}"
  hr
  echo ""
  printf "  ${BOLD}PR #%s${RESET} ${DIM}(%s)${RESET}\n" "$PR_NUMBER" "$PR_STATE"
  printf "  ${WHITE}%s${RESET}\n" "$PR_TITLE"
  printf "  ${DIM}by @%s  •  %s → %s${RESET}\n" "$PR_AUTHOR" "$PR_HEAD" "$PR_BASE"
  printf "  ${DIM}%s${RESET}\n" "$PR_URL"
  echo ""
  printf "  ${GREEN}+%s${RESET}  ${RED}-%s${RESET}  ${DIM}across %s files${RESET}\n" "$PR_ADDS" "$PR_DELS" "$PR_FILES"
  echo ""
  hr_light
  echo ""

  local session_resolved session_replied session_skipped
  session_resolved=$(jq '.resolved | length' "$PROGRESS_FILE")
  session_replied=$(jq '.replied | length' "$PROGRESS_FILE")
  session_skipped=$(jq '.skipped | length' "$PROGRESS_FILE")

  printf "  ${BOLD}Review Threads${RESET}\n"
  printf "  ${SYM_RESOLVED} Resolved (before session): ${GREEN}%s${RESET}\n" "$RESOLVED_COUNT"
  printf "  ${SYM_PENDING} Unresolved:                ${RED}%s${RESET}\n" "$UNRESOLVED_COUNT"
  echo ""
  printf "  ${BOLD}Session Progress${RESET}\n"
  printf "  ${GREEN}${SYM_CHECK} Resolved this session:  %s${RESET}\n" "$session_resolved"
  printf "  ${BLUE}${SYM_COMMENT} Replied this session:   %s${RESET}\n" "$session_replied"
  printf "  ${YELLOW}${SYM_ARROW} Skipped:                %s${RESET}\n" "$session_skipped"
  echo ""
}

# ── Render a single thread ───────────────────────────────────────────────────
render_thread() {
  local idx="$1"
  local thread
  thread=$(jq ".[$idx]" "$THREADS_JSON")

  local path line start_line is_outdated thread_id
  path=$(echo "$thread" | jq -r '.path')
  line=$(echo "$thread" | jq -r '.line // empty')
  start_line=$(echo "$thread" | jq -r '.startLine // empty')
  is_outdated=$(echo "$thread" | jq -r '.isOutdated')
  thread_id=$(echo "$thread" | jq -r '.id')

  local comment_count
  comment_count=$(echo "$thread" | jq '.comments.nodes | length')

  local line_display=""
  if [[ -n "$start_line" && "$start_line" != "null" && -n "$line" && "$line" != "null" && "$start_line" != "$line" ]]; then
    line_display="L${start_line}-L${line}"
  elif [[ -n "$line" && "$line" != "null" ]]; then
    line_display="L${line}"
  fi

  clear
  echo ""
  hr

  local outdated_badge=""
  if [[ "$is_outdated" == "true" ]]; then
    outdated_badge=" ${YELLOW}${SYM_OUTDATED} OUTDATED${RESET}"
  fi

  printf "  ${BOLD}Comment %d/%d${RESET}  ${SYM_PENDING} ${RED}UNRESOLVED${RESET}%s\n" \
    "$((idx + 1))" "$UNRESOLVED_COUNT" "$outdated_badge"
  hr
  echo ""

  # File path + line
  printf "  ${SYM_FILE} ${CYAN}${UNDERLINE}%s${RESET}" "$path"
  if [[ -n "$line_display" ]]; then
    printf "${DIM}:%s${RESET}" "$line_display"
  fi
  echo ""
  echo ""

  # ── Code context ──────────────────────────────────────────────────────
  if [[ -f "$path" && -n "$line" && "$line" != "null" ]]; then
    local ctx_start ctx_end
    ctx_start=$((line > 5 ? line - 5 : 1))
    ctx_end=$((line + 5))

    printf "  ${DIM}┌─── Code Context ───${RESET}\n"

    local lnum=0
    while IFS= read -r code_line || [[ -n "$code_line" ]]; do
      lnum=$((lnum + 1))
      if [[ $lnum -ge $ctx_start && $lnum -le $ctx_end ]]; then
        if [[ $lnum -eq $line ]]; then
          printf "  ${DIM}│${RESET} ${BG_RED}${WHITE}%4d ${RESET}${BG_RED} %s ${RESET}\n" "$lnum" "$code_line"
        elif [[ -n "$start_line" && "$start_line" != "null" && $lnum -ge $start_line && $lnum -le $line ]]; then
          printf "  ${DIM}│${RESET} ${YELLOW}%4d ${RESET}${YELLOW} %s${RESET}\n" "$lnum" "$code_line"
        else
          printf "  ${DIM}│ %4d  %s${RESET}\n" "$lnum" "$code_line"
        fi
      fi
      [[ $lnum -ge $ctx_end ]] && break
    done < "$path"

    printf "  ${DIM}└────────────────────${RESET}\n"
    echo ""
  fi

  # ── Comment thread ────────────────────────────────────────────────────
  hr_light
  printf "  ${BOLD}${SYM_COMMENT} Thread${RESET} ${DIM}(%d comment%s)${RESET}\n" \
    "$comment_count" "$( [[ $comment_count -ne 1 ]] && echo 's' )"
  hr_light
  echo ""

  local i=0
  while [[ $i -lt $comment_count ]]; do
    local comment author body created_at
    comment=$(echo "$thread" | jq ".comments.nodes[$i]")
    author=$(echo "$comment" | jq -r '.author.login // "ghost"')
    body=$(echo "$comment" | jq -r '.body')
    created_at=$(echo "$comment" | jq -r '.createdAt')

    # Format date
    local date_display
    if command -v gdate >/dev/null 2>&1; then
      date_display=$(gdate -d "$created_at" '+%b %d, %Y %H:%M' 2>/dev/null || echo "$created_at")
    elif date --version >/dev/null 2>&1; then
      date_display=$(date -d "$created_at" '+%b %d, %Y %H:%M' 2>/dev/null || echo "$created_at")
    else
      # macOS date
      date_display=$(date -j -f '%Y-%m-%dT%H:%M:%SZ' "$created_at" '+%b %d, %Y %H:%M' 2>/dev/null || echo "$created_at")
    fi

    if [[ $i -eq 0 ]]; then
      printf "  ${SYM_USER} ${BOLD}@%s${RESET}  ${DIM}%s${RESET}\n" "$author" "$date_display"
    else
      printf "  ${DIM}↳${RESET} ${BOLD}@%s${RESET}  ${DIM}%s${RESET}\n" "$author" "$date_display"
    fi

    # Indent and wrap comment body
    echo "$body" | while IFS= read -r bline; do
      printf "    %s\n" "$bline"
    done
    echo ""

    i=$((i + 1))
  done

  hr_light
}

# ── Action: Reply to a comment ───────────────────────────────────────────────
action_reply() {
  local idx="$1"
  local thread
  thread=$(jq ".[$idx]" "$THREADS_JSON")

  # Get the first comment's database ID (for threading replies)
  local first_comment_db_id
  first_comment_db_id=$(echo "$thread" | jq -r '.comments.nodes[0].databaseId')

  echo ""
  printf "  ${BOLD}${CYAN}Compose your reply${RESET} ${DIM}(enter an empty line to cancel, or type your message and press Enter twice to send):${RESET}\n"
  echo ""

  local reply_body=""
  local empty_count=0

  while true; do
    printf "  ${DIM}>${RESET} "
    IFS= read -r line
    if [[ -z "$line" ]]; then
      if [[ -z "$reply_body" ]]; then
        printf "  ${YELLOW}Reply cancelled.${RESET}\n"
        return 1
      fi
      empty_count=$((empty_count + 1))
      if [[ $empty_count -ge 1 ]]; then
        break
      fi
      reply_body="${reply_body}\n"
    else
      empty_count=0
      if [[ -n "$reply_body" ]]; then
        reply_body="${reply_body}\n${line}"
      else
        reply_body="$line"
      fi
    fi
  done

  # Convert \n back to actual newlines for the API
  local formatted_body
  formatted_body=$(printf '%b' "$reply_body")

  printf "\n  ${DIM}Posting reply…${RESET}"

  if gh api \
    "repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments/$first_comment_db_id/replies" \
    -f body="$formatted_body" >/dev/null 2>&1; then
    printf "\r  ${GREEN}${SYM_CHECK} Reply posted successfully!${RESET}\n"
    # Track in progress
    jq --arg id "$first_comment_db_id" '.replied += [$id]' "$PROGRESS_FILE" > "$PROGRESS_FILE.tmp" \
      && mv "$PROGRESS_FILE.tmp" "$PROGRESS_FILE"
    return 0
  else
    printf "\r  ${RED}${SYM_CROSS} Failed to post reply.${RESET}\n"
    return 1
  fi
}

# ── Action: Resolve a thread ─────────────────────────────────────────────────
action_resolve() {
  local idx="$1"
  local thread_id
  thread_id=$(jq -r ".[$idx].id" "$THREADS_JSON")

  printf "\n  ${DIM}Resolving thread…${RESET}"

  if gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }' -f threadId="$thread_id" >/dev/null 2>&1; then
    printf "\r  ${GREEN}${SYM_CHECK} Thread resolved!${RESET}          \n"
    jq --arg id "$thread_id" '.resolved += [$id]' "$PROGRESS_FILE" > "$PROGRESS_FILE.tmp" \
      && mv "$PROGRESS_FILE.tmp" "$PROGRESS_FILE"
    return 0
  else
    printf "\r  ${RED}${SYM_CROSS} Failed to resolve thread.${RESET}\n"
    return 1
  fi
}

# ── Action: Reply AND resolve ────────────────────────────────────────────────
action_reply_and_resolve() {
  local idx="$1"
  if action_reply "$idx"; then
    action_resolve "$idx"
  fi
}

# ── Action: Open file in editor ──────────────────────────────────────────────
action_edit() {
  local idx="$1"
  local thread
  thread=$(jq ".[$idx]" "$THREADS_JSON")

  local path line
  path=$(echo "$thread" | jq -r '.path')
  line=$(echo "$thread" | jq -r '.line // "1"')

  if [[ ! -f "$path" ]]; then
    printf "\n  ${RED}File not found: %s${RESET}\n" "$path"
    return 1
  fi

  local editor="${EDITOR:-${VISUAL:-vim}}"

  # Try to open at the right line
  case "$editor" in
    *vim*|*nvim*)
      "$editor" "+$line" "$path"
      ;;
    *code*|*cursor*)
      "$editor" --goto "$path:$line"
      ;;
    *subl*)
      "$editor" "$path:$line"
      ;;
    *)
      "$editor" "$path"
      ;;
  esac
}

# ── Action: Show diff for file ───────────────────────────────────────────────
action_diff() {
  local idx="$1"
  local thread
  thread=$(jq ".[$idx]" "$THREADS_JSON")
  local path
  path=$(echo "$thread" | jq -r '.path')

  echo ""
  printf "  ${BOLD}Diff for %s:${RESET}\n" "$path"
  hr_light
  git diff "$PR_BASE"..."$PR_HEAD" -- "$path" 2>/dev/null || \
    git diff HEAD -- "$path" 2>/dev/null || \
    printf "  ${DIM}No diff available.${RESET}\n"
  hr_light
}

# ── Action: Stage changes for file ───────────────────────────────────────────
action_stage() {
  local idx="$1"
  local thread
  thread=$(jq ".[$idx]" "$THREADS_JSON")
  local path
  path=$(echo "$thread" | jq -r '.path')

  if git add "$path" 2>/dev/null; then
    printf "\n  ${GREEN}${SYM_CHECK} Staged: %s${RESET}\n" "$path"
  else
    printf "\n  ${RED}${SYM_CROSS} Failed to stage: %s${RESET}\n" "$path"
  fi
}

# ── Thread list view ─────────────────────────────────────────────────────────
render_thread_list() {
  clear
  echo ""
  hr
  printf "${BOLD}${CYAN}"
  center "UNRESOLVED THREADS OVERVIEW"
  printf "${RESET}"
  hr
  echo ""

  local i=0
  while [[ $i -lt $UNRESOLVED_COUNT ]]; do
    local thread path line author body is_outdated
    thread=$(jq ".[$i]" "$THREADS_JSON")
    path=$(echo "$thread" | jq -r '.path')
    line=$(echo "$thread" | jq -r '.line // "?"')
    author=$(echo "$thread" | jq -r '.comments.nodes[0].author.login // "ghost"')
    body=$(echo "$thread" | jq -r '.comments.nodes[0].body' | head -1 | cut -c1-80)
    is_outdated=$(echo "$thread" | jq -r '.isOutdated')

    local status_icon="$SYM_PENDING"
    local thread_id
    thread_id=$(echo "$thread" | jq -r '.id')
    if jq -e --arg id "$thread_id" '.resolved | index($id)' "$PROGRESS_FILE" >/dev/null 2>&1; then
      status_icon="$SYM_RESOLVED"
    fi

    local outdated_mark=""
    [[ "$is_outdated" == "true" ]] && outdated_mark=" ${YELLOW}(outdated)${RESET}"

    printf "  %s ${BOLD}%2d.${RESET} ${CYAN}%s${RESET}:%s  ${DIM}@%s${RESET}%s\n" \
      "$status_icon" "$((i + 1))" "$path" "$line" "$author" "$outdated_mark"
    printf "      ${DIM}%s${RESET}\n" "$body"

    i=$((i + 1))
  done

  echo ""
  hr_light
}

# ── Action menu ──────────────────────────────────────────────────────────────
show_actions() {
  echo ""
  printf "  ${BOLD}Actions:${RESET}\n"
  printf "  ${CYAN}[n]${RESET}ext    ${CYAN}[p]${RESET}rev     ${CYAN}[g]${RESET}o to #   ${CYAN}[l]${RESET}ist all\n"
  printf "  ${GREEN}[r]${RESET}eply   ${GREEN}[R]${RESET}esolve  ${GREEN}[b]${RESET}oth (reply+resolve)\n"
  printf "  ${YELLOW}[e]${RESET}dit    ${YELLOW}[d]${RESET}iff     ${YELLOW}[a]${RESET}dd/stage\n"
  printf "  ${MAGENTA}[s]${RESET}kip    ${RED}[q]${RESET}uit\n"
  echo ""
}

read_key() {
  printf "  ${BOLD}${SYM_ARROW}${RESET} "
  read -rsn1 key
  echo ""
  echo "$key"
}

wait_key() {
  printf "\n  ${DIM}Press any key to continue…${RESET}"
  read -rsn1
}

# ── Summary screen ───────────────────────────────────────────────────────────
render_summary() {
  clear
  echo ""
  hr
  printf "${BOLD}${GREEN}"
  center "SESSION COMPLETE"
  printf "${RESET}"
  hr
  echo ""

  local session_resolved session_replied session_skipped
  session_resolved=$(jq '.resolved | length' "$PROGRESS_FILE")
  session_replied=$(jq '.replied | length' "$PROGRESS_FILE")
  session_skipped=$(jq '.skipped | length' "$PROGRESS_FILE")

  printf "  ${BOLD}PR #%s${RESET} — %s\n" "$PR_NUMBER" "$PR_TITLE"
  echo ""
  printf "  ${GREEN}${SYM_CHECK} Resolved:  %s threads${RESET}\n" "$session_resolved"
  printf "  ${BLUE}${SYM_COMMENT} Replied:   %s comments${RESET}\n" "$session_replied"
  printf "  ${YELLOW}${SYM_ARROW} Skipped:   %s threads${RESET}\n" "$session_skipped"
  echo ""

  local remaining=$((UNRESOLVED_COUNT - session_resolved))
  if [[ $remaining -le 0 ]]; then
    printf "  ${BOLD}${GREEN}🎉 All review threads resolved!${RESET}\n"
  else
    printf "  ${DIM}%d thread(s) still unresolved.${RESET}\n" "$remaining"
  fi
  echo ""

  # Check for unstaged changes
  local unstaged
  unstaged=$(git diff --name-only 2>/dev/null | head -20)
  if [[ -n "$unstaged" ]]; then
    hr_light
    printf "\n  ${YELLOW}${BOLD}Unstaged changes detected:${RESET}\n"
    echo "$unstaged" | while IFS= read -r f; do
      printf "    ${YELLOW}M${RESET} %s\n" "$f"
    done
    echo ""
    printf "  ${DIM}Remember to stage, commit, and push your changes.${RESET}\n"
  fi

  # Check for staged changes
  local staged
  staged=$(git diff --cached --name-only 2>/dev/null | head -20)
  if [[ -n "$staged" ]]; then
    printf "\n  ${GREEN}${BOLD}Staged changes:${RESET}\n"
    echo "$staged" | while IFS= read -r f; do
      printf "    ${GREEN}A${RESET} %s\n" "$f"
    done
    echo ""
    printf "  ${DIM}Ready to commit.${RESET}\n"
  fi

  echo ""
  hr
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN LOOP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [[ $UNRESOLVED_COUNT -eq 0 ]]; then
  render_dashboard
  printf "  ${GREEN}${BOLD}🎉 No unresolved review threads! Nothing to do.${RESET}\n\n"
  exit 0
fi

# Show dashboard first
render_dashboard
printf "  ${BOLD}Press any key to begin reviewing %d unresolved thread%s…${RESET}" \
  "$UNRESOLVED_COUNT" "$( [[ $UNRESOLVED_COUNT -ne 1 ]] && echo 's' )"
read -rsn1
echo ""

# Main navigation loop
CURRENT_IDX=0

while true; do
  render_thread "$CURRENT_IDX"
  show_actions
  key=$(read_key)

  case "$key" in
    n) # Next
      if [[ $CURRENT_IDX -lt $((UNRESOLVED_COUNT - 1)) ]]; then
        CURRENT_IDX=$((CURRENT_IDX + 1))
      else
        printf "  ${DIM}Already at the last thread.${RESET}"
        wait_key
      fi
      ;;

    p) # Previous
      if [[ $CURRENT_IDX -gt 0 ]]; then
        CURRENT_IDX=$((CURRENT_IDX - 1))
      else
        printf "  ${DIM}Already at the first thread.${RESET}"
        wait_key
      fi
      ;;

    g) # Go to specific thread
      printf "  Go to thread # (1-%d): " "$UNRESOLVED_COUNT"
      read -r target_num
      if [[ "$target_num" =~ ^[0-9]+$ ]] && [[ $target_num -ge 1 ]] && [[ $target_num -le $UNRESOLVED_COUNT ]]; then
        CURRENT_IDX=$((target_num - 1))
      else
        printf "  ${RED}Invalid thread number.${RESET}"
        wait_key
      fi
      ;;

    l) # List all threads
      render_thread_list
      printf "  ${DIM}Press any key to return…${RESET}"
      read -rsn1
      ;;

    r) # Reply
      action_reply "$CURRENT_IDX"
      wait_key
      ;;

    R) # Resolve
      action_resolve "$CURRENT_IDX"
      wait_key
      ;;

    b) # Both reply + resolve
      action_reply_and_resolve "$CURRENT_IDX"
      wait_key
      ;;

    e) # Edit file
      action_edit "$CURRENT_IDX"
      ;;

    d) # Show diff
      action_diff "$CURRENT_IDX"
      wait_key
      ;;

    a) # Stage file
      action_stage "$CURRENT_IDX"
      wait_key
      ;;

    s) # Skip
      local_thread_id=$(jq -r ".[$CURRENT_IDX].id" "$THREADS_JSON")
      jq --arg id "$local_thread_id" '.skipped += [$id]' "$PROGRESS_FILE" > "$PROGRESS_FILE.tmp" \
        && mv "$PROGRESS_FILE.tmp" "$PROGRESS_FILE"
      printf "  ${YELLOW}Skipped.${RESET}"
      if [[ $CURRENT_IDX -lt $((UNRESOLVED_COUNT - 1)) ]]; then
        CURRENT_IDX=$((CURRENT_IDX + 1))
      else
        wait_key
      fi
      ;;

    q) # Quit
      render_summary
      exit 0
      ;;

    *)
      printf "  ${DIM}Unknown key. Press one of the listed options.${RESET}"
      wait_key
      ;;
  esac
done
