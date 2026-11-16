export const triageConfigPath = "{{HOME}}/.config/opencode/harness/turn-triage.json";

export function readTriageTag(reply: string): string {
  const tail = reply.split("\n").filter(line => line.trim()).slice(-3);
  for (const line of tail.reverse()) {
    const match = line.trim().match(/^[\W_]*triage:\s*(done|wait|question)[\W_]*$/i);
    if (match) return match[1].toLowerCase();
  }
  return "untagged";
}

export function triageTitle(mark: string, name: string): string {
  return `${mark} ${name.replace(/[\x00-\x1f\x7f-\x9f]/g, " ")}`;
}
