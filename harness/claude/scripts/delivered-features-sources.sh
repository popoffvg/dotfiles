#!/usr/bin/env bash
# Collect one author's commits since a date, and download the context repos, for the delivered-features report.
# Writes <out>/commits/<repo>.tsv (date, on_main yes|no, subject) and <out>/context/<repo>/.
set -euo pipefail

usage() {
	cat <<'EOF'
usage: delivered-features-sources.sh --since YYYY-MM-DD --out DIR [--author REGEX] [--gh-user USER]
         [--context OWNER/REPO]... REPO...
  REPO     a local clone path, or gh:OWNER/REPO to read the default branch through the GitHub API
  --author git --author regex, and the email regex for gh: repos (default: popo)
  --gh-user the gh account with org access; its token is passed to gh only (default: active account)
  --context a private repo to download as a tarball into <out>/context/<repo>
EOF
	exit 2
}

since="" out="" author="popo" gh_user=""
contexts=() repos=()
while (($#)); do
	case "$1" in
	--since) since="$2"; shift 2 ;;
	--out) out="$2"; shift 2 ;;
	--author) author="$2"; shift 2 ;;
	--gh-user) gh_user="$2"; shift 2 ;;
	--context) contexts+=("$2"); shift 2 ;;
	-h | --help) usage ;;
	*) repos+=("$1"); shift ;;
	esac
done
[[ -n "$since" && -n "$out" ]] || usage
mkdir -p "$out/commits" "$out/context"

if [[ -n "$gh_user" ]]; then
	GH_TOKEN="$(gh auth token --user "$gh_user")"
	export GH_TOKEN
fi

for repo in "${repos[@]}"; do
	if [[ "$repo" == gh:* ]]; then
		slug="${repo#gh:}"
		file="$out/commits/${slug##*/}.tsv"
		gh api "repos/$slug/commits?since=${since}T00:00:00Z&per_page=100" --paginate \
			-q ".[] | select(.commit.author.email | test(\"$author\"; \"i\")) | [.commit.author.date[:10], \"yes\", (.commit.message | split(\"\n\")[0])] | @tsv" \
			| grep -v -E $'\t(fixup!|squash!|Merge )' | sort -u >"$file" || true
	else
		file="$out/commits/$(basename "$repo").tsv"
		main_ref="$(git -C "$repo" symbolic-ref -q --short refs/remotes/origin/HEAD || true)"
		for ref in "$main_ref" origin/main origin/master main master; do
			if [[ -n "$ref" ]] && git -C "$repo" rev-parse -q --verify "$ref" >/dev/null; then main_ref="$ref"; break; fi
		done
		on_main="$(mktemp)"
		git -C "$repo" log "$main_ref" --since="$since" --author="$author" -i --no-merges --format='%s' | sort -u >"$on_main"
		git -C "$repo" log --all --since="$since" --author="$author" -i --no-merges --format=$'%ad\t%s' --date=short \
			| grep -v -E $'\t(fixup!|squash!|wip)' | sort -u -t$'\t' -k2,2 | sort \
			| while IFS=$'\t' read -r day subject; do
				if grep -qxF -- "$subject" "$on_main"; then state=yes; else state=no; fi
				printf '%s\t%s\t%s\n' "$day" "$state" "$subject"
			done >"$file"
		rm -f "$on_main"
	fi
	printf '%-40s %5s commits, %5s on main\n' "$(basename "$file" .tsv)" "$(wc -l <"$file")" "$(awk -F'\t' '$2=="yes"' "$file" | wc -l)"
done

for slug in "${contexts[@]}"; do
	dest="$out/context/${slug##*/}"
	rm -rf "$dest" && mkdir -p "$dest"
	gh api "repos/$slug/tarball" | tar -xzf - -C "$dest" --strip-components=1
	echo "context $slug -> $dest"
done
