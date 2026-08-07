/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Model - Model alias passed to claude -p --model */
  "model": string,
  /** Script Path - grammar-check.sh that runs the check and appends to the topic log */
  "scriptPath": string,
  /** Topic Log - TSV file collecting one row per fix topic */
  "logPath": string,
  /** Prefill - undefined */
  "prefill": boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `check-grammar` command */
  export type CheckGrammar = ExtensionPreferences & {}
  /** Preferences accessible in the `grammar-topics` command */
  export type GrammarTopics = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `check-grammar` command */
  export type CheckGrammar = {}
  /** Arguments passed to the `grammar-topics` command */
  export type GrammarTopics = {}
}

