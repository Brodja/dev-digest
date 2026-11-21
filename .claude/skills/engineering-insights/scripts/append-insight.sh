#!/usr/bin/env bash
# Append one insight to <package>/INSIGHTS.md. Append-only: existing lines are never rewritten.
# Usage: append-insight.sh <package> <category> "<insight>" "<path:line>[, <path:line>...]"
set -euo pipefail

pkg=${1:?package}; cat=${2:?category}; text=${3:?insight}; refs=${4:?path:line evidence}
root=$(git rev-parse --show-toplevel)
log="$root/$pkg/INSIGHTS.md"

case $pkg in client|server|reviewer-core|e2e) ;; *) echo "unknown package: $pkg" >&2; exit 2 ;; esac
case $cat in dependency|fix|measured|oddity) ;; *) echo "unknown category: $cat (dependency|fix|measured|oddity)" >&2; exit 2 ;; esac
[[ -f $log ]] || { echo "no $pkg/INSIGHTS.md" >&2; exit 2; }
[[ $text != *$'\n'* && $text != *' · '* ]] || { echo "insight must be one line without ' · '" >&2; exit 2; }

# Evidence gate: every path:line must point into an existing file (repo-root-relative, forward slashes).
IFS=',' read -ra items <<< "$refs"
for ref in "${items[@]}"; do
  ref=${ref# }; ref=${ref% }
  path=${ref%:*}; lines=${ref##*:}
  [[ $ref == *:* && $lines =~ ^[0-9]+(-[0-9]+)?$ ]] || { echo "bad evidence '$ref' (want path:line or path:a-b)" >&2; exit 2; }
  [[ -f $root/$path ]] || { echo "evidence file not found: $path" >&2; exit 2; }
  last=${lines#*-}; total=$(wc -l < "$root/$path")
  (( 10#$last >= 1 && 10#$last <= total + 1 )) || { echo "$path has $total lines, got $lines" >&2; exit 2; }
done

# Same evidence already logged → probably a duplicate; the agent must re-read the log and decide.
if [[ -z ${INSIGHT_ALLOW_SAME_REF:-} ]] && grep -qF -- "· $refs" "$log"; then
  echo "$pkg/INSIGHTS.md already cites $refs — re-read it; set INSIGHT_ALLOW_SAME_REF=1 only for a different insight" >&2
  exit 3
fi

entry="- $(date +%F) · $cat · $text · $refs"
[[ -z $(tail -c1 "$log") ]] || printf '\n' >> "$log"        # make sure the file ends with a newline
[[ $(tail -n1 "$log") == '- '* ]] || printf '\n' >> "$log"   # blank line between the header and the first entry
printf '%s\n' "$entry" >> "$log"
echo "appended to $pkg/INSIGHTS.md: $entry"
