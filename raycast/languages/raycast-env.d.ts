/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** LanguageTool URL - LanguageTool server; brew services start languagetool runs it on port 8081 */
  "languageToolUrl": string,
  /** Language - LanguageTool language code */
  "language": string,
  /** Polish Model - Ollama model that suggests the polished text */
  "polishModel": string,
  /** Inbox - Folder that gets one file for each check with mistakes: the texts and the LanguageTool rules */
  "inboxDir": string,
  /** Prefill - Prefill the form with the selected text or clipboard */
  "prefill": boolean,
  /** Supervoc URL - The supervoc server, for example https://supervoc.example.com */
  "supervocUrl": string,
  /** Supervoc Access Token - The bearer token that the supervoc /token page issues */
  "supervocAccessToken": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `check-grammar` command */
  export type CheckGrammar = ExtensionPreferences & {}
  /** Preferences accessible in the `translate` command */
  export type Translate = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `check-grammar` command */
  export type CheckGrammar = {}
  /** Arguments passed to the `translate` command */
  export type Translate = {}
}

