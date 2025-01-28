#!/bin/sh

fd() {
    git diff $@ --name-only | fzf -m --ansi --preview "git diff $@ --color=always -- {-1}"
}
fd $@

