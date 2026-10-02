import { getPreferenceValues } from "@raycast/api";
import { homedir } from "os";
import { join } from "path";

export interface LanguagesPreferences {
  languageToolUrl: string;
  language: string;
  polishModel: string;
  inboxDir: string;
  prefill: boolean;
  vocabBinary: string;
}

function expandHome(path: string): string {
  return path.startsWith("~") ? join(homedir(), path.slice(1)) : path;
}

export function languagesPreferences(): LanguagesPreferences {
  const raw = getPreferenceValues<Partial<LanguagesPreferences>>();
  return {
    languageToolUrl: (
      raw.languageToolUrl?.trim() || "http://localhost:8081"
    ).replace(/\/$/, ""),
    language: raw.language?.trim() || "en-US",
    polishModel: raw.polishModel?.trim() || "phi4-mini",
    inboxDir: expandHome(raw.inboxDir?.trim() || "~/ctx/grammar/inbox"),
    prefill: raw.prefill !== false,
    vocabBinary: expandHome(
      raw.vocabBinary?.trim() || "~/git/dotfiles/scripts/vocab/vocab",
    ),
  };
}
