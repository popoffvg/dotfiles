#!/usr/bin/env node
/**
 * mdshow — show one or more markdown files in a native window, collect the
 * reader's annotations, print the feedback on stdout for a coding agent to read.
 *
 * Several files share one window and one submit, because the reader's answer is
 * one round of feedback per turn, not one per file.
 *
 * stdout carries agent-facing text and nothing else: the caller inlines it
 * straight into a prompt, so a diagnostic there would be read as feedback.
 *
 * The window runs in a detached `serve` process and writes its result to a
 * session file. `show` waits a bounded time, `wait` resumes waiting. That is
 * what keeps the reader free to take longer than the caller's time limit.
 */

import { spawn } from "node:child_process";
import { openSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBundle, buildDocument, buildPage, bundlePaths, documentId } from "../src/page.js";
import { composeFeedback, CANCELLED_FEEDBACK } from "../src/feedback.js";
import {
  awaitResult,
  dropResult,
  lastSession,
  logPath,
  markClosed,
  markOpen,
  newSessionId,
  openPath,
  readLog,
  pruneStaleResults,
  writeResult,
} from "../src/session.js";

const SELF = fileURLToPath(import.meta.url);

const USAGE = `Usage:
  mdshow show <file.md> [more.md ...] [options]   open the window and wait for feedback
  mdshow wait <session-id|--last>                 keep waiting for a window that is still open

Several files share one window: the reader switches between them with the tabs in
the header and sends one round of feedback for all of them.

Both wait for as long as the reader needs, unless --seconds is given.

Options for show:
  --title <text>     window title (default: "Review — <file name>", or "<n> files")
  --width <px>       window width (default: 1000)
  --height <px>      window height (default: 720)
  --no-floating      do not keep the window above other windows
  --seconds <n>      give up waiting after n seconds and print how to resume
  --print-html       print the page HTML and exit, without opening a window
  --simulate <file>  compose feedback from a submission JSON, without a window
  -h, --help         show this help
`;

function parseArgs(argv) {
  const options = { width: 1000, height: 720 };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "--print-html":
        options.printHtml = true;
        break;
      case "--no-floating":
        options.floating = false;
        break;
      case "--last":
        options.last = true;
        break;
      case "--title":
        options.title = argv[++index];
        break;
      case "--simulate":
        options.simulate = argv[++index];
        break;
      case "--session":
        options.session = argv[++index];
        break;
      case "--width":
        options.width = Number(argv[++index]);
        break;
      case "--height":
        options.height = Number(argv[++index]);
        break;
      case "--seconds":
        options.seconds = Number(argv[++index]);
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        positional.push(arg);
    }
  }

  return { options, positional };
}

/** stdout, not stderr: the caller inlines stdout into the agent's prompt. */
function fail(message) {
  process.stdout.write(`mdshow could not show the document: ${message}\n`);
  process.exit(1);
}

function stillOpenNotice(path, sessionId, waited) {
  return [
    `The review window for ${path} is open. The reader has not sent feedback yet (waited ${waited}s).`,
    "",
    "If they say no window appeared: it opens on the desktop Space they were on when it launched, so a",
    "fullscreen terminal hides it. Tell them to click the glimpse icon in the Dock or leave fullscreen.",
    "",
    "Wait for them — their feedback is the point of this step:",
    `  mdshow wait ${sessionId}`,
    "",
    "Run that with the Bash tool and repeat it until it prints feedback. Do not review the document",
    "yourself, do not guess the feedback, and do not start other work while waiting.",
  ].join("\n");
}

function launchFailure(path, error) {
  return [
    `The review window for ${path} never opened, so the reader saw nothing. This is not a review result.`,
    error != null ? `The window process reported: ${error}` : "The window process exited before it finished loading.",
    "",
    "Most likely the command ran inside the Claude Code command sandbox, which blocks a process from",
    "talking to the macOS window server. Tell the reader to check the log named below, and to run the",
    "same command in their own terminal to see the window:",
  ].join("\n");
}

const NO_OPEN_WINDOW = [
  "No review window is open, so there is nothing to wait for.",
  "Either the reader already closed it and the feedback was collected, or none was opened.",
].join("\n");

/**
 * Read every file into one bundle. One unreadable file fails the whole call:
 * showing a partial set would let the reader review the wrong thing without
 * knowing a file is missing.
 */
function loadBundle(files) {
  const documents = [];
  const absolutes = [];

  for (const [index, file] of files.entries()) {
    const absolute = resolve(file);
    let source;
    try {
      source = readFileSync(absolute, "utf8");
    } catch (error) {
      fail(`cannot read ${file} (${error.code ?? error.message}).`);
      return null;
    }
    // A relative path only helps when it is actually shorter — from a deep cwd it
    // turns into a chain of `../`.
    const fromCwd = relative(process.cwd(), absolute);
    const shortPath = fromCwd === "" || fromCwd.startsWith("..") ? absolute : fromCwd;
    documents.push(buildDocument(source, shortPath, documentId(index)));
    absolutes.push(absolute);
  }

  return { bundle: buildBundle(documents), absolutes };
}

function defaultTitle(absolutes) {
  return absolutes.length === 1 ? `Review — ${basename(absolutes[0])}` : `Review — ${absolutes.length} files`;
}

/** The detached process that owns the window until the reader is done. */
async function serve(files, options) {
  const loaded = loadBundle(files);
  if (loaded == null) return;
  const { bundle, absolutes } = loaded;
  const paths = bundlePaths(bundle);
  const title = options.title ?? defaultTitle(absolutes);

  const { open } = await import("glimpseui");
  const window = open(buildPage(bundle, title), {
    width: options.width,
    height: options.height,
    title,
    // Without this the window sits behind the terminal that asked for it, and a
    // reader working in a fullscreen terminal never sees it appear at all.
    floating: options.floating !== false,
  });

  markOpen(options.session, paths);

  // A window that dies before it is ready never reached the reader. Reporting
  // that as "the reader closed it" hides a launch failure behind a normal outcome.
  let ready = false;
  let launchError = null;

  const submission = await new Promise((settle) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      settle(value);
    };

    window.on("ready", () => {
      ready = true;
    });
    window.on("message", (message) => {
      if (message?.type === "submit") finish(message);
      else if (message?.type === "cancel") finish(null);
      else process.stderr.write(`mdshow: ${JSON.stringify(message)}\n`);
    });
    window.on("closed", () => finish(null));
    window.on("error", (error) => {
      launchError = error instanceof Error ? error.message : String(error);
      process.stderr.write(`mdshow: window error: ${launchError}\n`);
      finish(null);
    });
  });

  try {
    window.close();
  } catch {
    // Already gone because the reader closed it.
  }

  const failedToLaunch = submission == null && !ready;

  writeResult(options.session, {
    cancelled: submission == null,
    failedToLaunch,
    feedback: failedToLaunch
      ? launchFailure(paths, launchError)
      : submission == null
        ? CANCELLED_FEEDBACK
        : composeFeedback(bundle, submission),
  });
  markClosed(options.session);
  process.exit(0);
}

async function show(files, options) {
  const loaded = loadBundle(files);
  if (loaded == null) return;
  const { bundle, absolutes } = loaded;
  const title = options.title ?? defaultTitle(absolutes);

  if (options.printHtml === true) {
    process.stdout.write(buildPage(bundle, title));
    return;
  }

  if (options.simulate != null) {
    const submission = JSON.parse(readFileSync(options.simulate, "utf8"));
    process.stdout.write(`${composeFeedback(bundle, submission)}\n`);
    return;
  }

  pruneStaleResults();
  const sessionId = newSessionId();
  const child = spawn(
    process.execPath,
    [
      SELF,
      "serve",
      ...absolutes,
      "--session",
      sessionId,
      "--width",
      String(options.width),
      "--height",
      String(options.height),
      ...(options.floating === false ? ["--no-floating"] : []),
      ...(options.title != null ? ["--title", options.title] : []),
    ],
    // Keep the window process's stderr: when the window fails to open, that log
    // is the only evidence of why.
    { detached: true, stdio: ["ignore", "ignore", openSync(logPath(sessionId), "a")], cwd: process.cwd() },
  );
  child.unref();

  await collect(sessionId, bundlePaths(bundle), options);
}

async function wait(target, options) {
  const sessionId = target === "--last" || target === "last" ? lastSession() : target;

  if (sessionId == null) {
    process.stdout.write(`${NO_OPEN_WINDOW}\n`);
    return;
  }

  await collect(sessionId, openPath(sessionId) ?? "the document", options);
}

/** Wait for the window's result — by default for as long as the reader needs. */
async function collect(sessionId, path, options) {
  const seconds = options.seconds;
  const result = await awaitResult(sessionId, seconds == null ? Infinity : seconds * 1000);

  if (result == null) {
    process.stdout.write(`${stillOpenNotice(path, sessionId, seconds)}\n`);
    return;
  }

  dropResult(sessionId);
  markClosed(sessionId);

  if (result.failedToLaunch === true) {
    const log = readLog(sessionId);
    process.stdout.write(`${result.feedback}\n  ${logPath(sessionId)}\n`);
    if (log !== "") process.stdout.write(`\nThe log says:\n${log}\n`);
    return;
  }

  process.stdout.write(`${result.feedback}\n`);
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    return;
  }

  const { options, positional } = parsed;
  if (options.help === true || positional.length === 0) {
    process.stdout.write(USAGE);
    return;
  }

  const [command, ...rest] = positional;

  switch (command) {
    case "show":
      if (rest.length === 0) return fail(`no file given.\n${USAGE}`);
      return show(rest, options);
    case "wait":
      return wait(options.last === true ? "--last" : rest[0] ?? "--last", options);
    case "serve":
      if (rest.length === 0 || options.session == null) return fail("serve needs a file and --session.");
      return serve(rest, options);
    default:
      // Bare paths keep `mdshow file.md other.md` working.
      if (!command.startsWith("-")) return show([command, ...rest], options);
      return fail(`unknown command: ${command}\n${USAGE}`);
  }
}

await main();
