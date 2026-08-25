#!/bin/zsh
# Probe what the user's real interactive zsh offers for a partial command line.
#
# Spawns /bin/zsh -i inside a zpty (so ZLE and the completion system are live,
# which they are not under `zsh -c`), types the line, presses Tab, and dumps
# whatever the completion system painted.
#
# Usage: zsh-completion-probe.sh '<partial line>' [tab-count] [wait-seconds]
#   zsh-completion-probe.sh 'git ch'
#   zsh-completion-probe.sh 'g ch' 2 3

emulate -L zsh
setopt err_return no_unset

zmodload zsh/zpty || { print -ru2 -- "zsh/zpty unavailable"; exit 1 }

local line=${1:?usage: zsh-completion-probe.sh '<partial line>' [tabs] [wait]}
local -i tabs=${2:-1}
local -i wait_s=${3:-3}

local name=probe$$
# COLUMNS wide enough that a completion list is not wrapped into noise.
zpty -b $name "TERM=${PROBE_TERM:-dumb} COLUMNS=200 LINES=50 /bin/zsh -i"

# Drain everything the rc files print before the first prompt. Reading with a
# short timeout until it goes quiet is more reliable than matching a prompt
# pattern -- this user's prompt is drawn by starship and is not a fixed string.
local chunk drained=
while zpty -r -t $name chunk 2>/dev/null; do
	drained+=$chunk
done
sleep 1
while zpty -r -t $name chunk 2>/dev/null; do
	drained+=$chunk
done

zpty -w -n $name "$line"
# An inline-suggestion engine (deja) fetches asynchronously. Pressing Tab before
# the ghost lands tests a different code path than a human typing does, so wait.
sleep ${PROBE_SETTLE:-0.4}
# PROBE_KEY overrides the key sent, for setups that put completion somewhere
# other than Tab. Give it a real escape sequence, e.g. $'\e[B' for Down.
local key=${PROBE_KEY:-$'\t'}
local -i i
for (( i = 0; i < tabs; i++ )); do
	zpty -w -n $name "$key"
	sleep 0.6
done

# Completion can shell out (carapace forks a binary), so give it real time.
local out=
local -i deadline=$(( SECONDS + wait_s ))
while (( SECONDS < deadline )); do
	while zpty -r -t $name chunk 2>/dev/null; do
		out+=$chunk
	done
	sleep 0.2
done

zpty -d $name 2>/dev/null

print -r -- "=== probe: ${(qq)line} + ${tabs} TAB ==="
# A `menu select` list is drawn with highlight sequences and redraws in place, so
# stripping blank lines throws the list away. PROBE_RAW=1 keeps everything.
if [[ -n ${PROBE_RAW:-} ]]; then
	print -r -- "$out" | cat -v
else
	print -r -- "$out" | perl -pe 's/\e\[[0-9;?]*[a-zA-Z]//g; s/\e[()][B0]//g; s/\r//g' \
		| grep -v '^[[:space:]]*$'
fi
