import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { register as registerCompactStartup } from "./modules/compact-startup";
import { register as registerReadmd } from "./modules/readmd-command";
import { register as registerRtk } from "./modules/rtk";
import { register as registerRepoContext } from "./modules/repo-context";
import { register as registerSessionExport } from "./modules/session-export";
import { register as registerRolePicker } from "./modules/role-picker";
import { register as registerMode } from "./modules/mode-scope";
import { register as registerGrepai } from "./modules/grepai";
import { register as registerPromptRewriter } from "./modules/prompt-rewriter";

export default function (pi: ExtensionAPI) {
  registerCompactStartup(pi);
  registerRepoContext(pi);
  registerReadmd(pi);
  registerRtk(pi);
  registerSessionExport(pi);
  registerRolePicker(pi);
  registerMode(pi);

  // DISABLED (were '!'-prefixed in pi settings). Uncomment to enable.
  // registerGrepai(pi);
  // registerPromptRewriter(pi);
}
