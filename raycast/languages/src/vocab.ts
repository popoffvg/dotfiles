import { execFile } from "child_process";
import { promisify } from "util";
import { languagesPreferences } from "./preferences";

const run = promisify(execFile);

export interface VocabPair {
  en: string;
  ru: string;
  dup: boolean;
  path: string;
}

export async function translateWithVocab(text: string): Promise<VocabPair> {
  const { vocabBinary } = languagesPreferences();
  try {
    const { stdout } = await run(vocabBinary, ["translate", text]);
    return JSON.parse(stdout) as VocabPair;
  } catch (failure) {
    const stderr =
      failure && typeof failure === "object" && "stderr" in failure
        ? String(failure.stderr).trim()
        : "";
    const message =
      failure instanceof Error ? failure.message : String(failure);
    throw new Error(`vocab translate: ${stderr || message}`);
  }
}
