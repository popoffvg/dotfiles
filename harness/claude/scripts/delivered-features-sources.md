---
name: delivered-features-sources.sh
description: Collect one author's commits since a date from local clones and GitHub repos, mark each as on main or not, and download the context repos as tarballs.
args: "--since YYYY-MM-DD --out DIR [--author REGEX] [--gh-user USER] [--context OWNER/REPO]... REPO..."
needs: git, gh
used_by: delivered-features skill
---
