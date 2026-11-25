---
name: firecrawl
description: |
  Fetch, search, and map the web with the `firecrawl` CLI. It returns clean markdown for a LLM context window, renders JavaScript, and reads pages the built-in tools cannot.

  USE FIRECRAWL FOR:
  - Scrape: any URL, page, doc, or article
  - Search: web, image, and news queries — "check the web", "look up", "find online"
  - Map and crawl: link discovery over a whole site

  Prefer it over WebFetch and WebSearch for these three operations. See SKILL.md for syntax, rules/install.md for auth.
---

# Firecrawl CLI

Use the `firecrawl` CLI to scrape, search, and map the web. Prefer it over WebFetch and WebSearch. Another skill that owns its own retrieval — `deep-research`, `mictx:research` — keeps its own tools.

## Steps

1. Run `firecrawl --status`. It prints the auth state, the concurrency limit, and the remaining credits. Each scrape and each crawl uses credits. If the CLI is missing or not logged in, follow [rules/install.md](rules/install.md).
2. Create a `.firecrawl/` folder in the working directory, and add `.firecrawl/` to `.gitignore`. Skip this step only when the user asks for the result in context.
3. Run the command with `-o .firecrawl/<name>` on every call, so the output goes to a file and not into the context. Quote every URL: the shell reads `?` and `&` as special characters.
4. Read the output file in parts — `wc -l`, `head`, `grep -n`, or `Read` with `offset`/`limit` — because one file often runs past 1000 lines. Read it whole only when the user asks or the task needs every line.

Done when every result the task needs is in a file under `.firecrawl/` and you read only the parts the task needs.

## Commands

Run `firecrawl <command> --help` for the full list of flags.

```bash
firecrawl search "your query" --json -o .firecrawl/search-react_server_components.json
firecrawl search "AI news" --sources news --tbs qdr:d --json -o .firecrawl/search-ai_news.json
firecrawl search "API docs" --scrape --json -o .firecrawl/search-api_docs-scraped.json
firecrawl scrape "https://docs.github.com/actions/overview" --only-main-content -o .firecrawl/docs.github.com-actions-overview.md
firecrawl scrape "https://spa-app.com" --wait-for 3000 -o .firecrawl/spa-app.com.md
firecrawl map "https://example.com" --search "blog" -o .firecrawl/example.com-blog-urls.txt
```

- `search` — a web, news, or image search. `--scrape` also scrapes each result. `--categories github,research,pdf` filters by source type. `--tbs qdr:h|d|w|m|y` limits the time range.
- `scrape` — one page. `--wait-for <ms>` waits for the JavaScript to render. One `--format` writes the raw content (markdown, HTML); two or more formats, such as `--format markdown,links`, write JSON with each format.
- `map` — every URL of a site, one per line. `--search <query>` filters the URLs.
- Name a file after its query or its site and path. Put one-time scripts in `.firecrawl/scratchpad/`.
- The search JSON holds the results under `.data.web[]` and `.data.news[]`: `jq -r '.data.web[] | "\(.title): \(.url)"' .firecrawl/search-query.json`.

## Parallel scrapes

Run independent scrapes in parallel, up to the concurrency limit that `firecrawl --status` prints. Send the whole batch as one `Bash` call with `run_in_background: true`: put `&` after each job and `wait` at the end.

```bash
firecrawl scrape "https://site1.com" -o .firecrawl/1.md &
firecrawl scrape "https://site2.com" -o .firecrawl/2.md &
wait
```

For many URLs, use `xargs -P`:

```bash
cat urls.txt | xargs -P 10 -I {} sh -c 'firecrawl scrape "{}" -o ".firecrawl/$(echo {} | md5).md"'
```
