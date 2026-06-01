#!/bin/bash
command -v codedb >/dev/null 2>&1 || exit 0
codedb . status >/dev/null 2>&1 &
exit 0
