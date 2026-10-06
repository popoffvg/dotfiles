import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export const SUMMARIZE_FROM_BOTTOM = "Summarize from bottom";
export const SUMMARIZE_FROM_UP = "Summarize from up";
export const CURRENT_BEHAVIOUR = "Current behaviour";

export const CONVERSATION_MODE_CHOICES = [
	SUMMARIZE_FROM_BOTTOM,
	SUMMARIZE_FROM_UP,
	CURRENT_BEHAVIOUR,
] as const;

export type ConversationMode = (typeof CONVERSATION_MODE_CHOICES)[number];

export function compactPrefix(ctx: ExtensionCommandContext): Promise<void> {
	return new Promise((resolve, reject) => {
		ctx.compact({
			customInstructions:
				"Summarize the older conversation above the current restore point. Keep this restored user message and anything after it.",
			onComplete: () => resolve(),
			onError: (error) => reject(error),
		});
	});
}
