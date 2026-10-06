import type { GitResetTarget } from "./git-history.ts";
import {
	CURRENT_BEHAVIOUR,
	SUMMARIZE_FROM_BOTTOM,
	SUMMARIZE_FROM_UP,
	type ConversationMode,
} from "./conversation-mode.ts";

export interface RestoreAction {
	label: string;
	restoreCode: boolean;
	restoreConversation: boolean;
	resetGit: boolean;
	conversationMode?: ConversationMode;
	cancel?: boolean;
}

function countLabel(count: number, singular: string, plural: string): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

export function gitResetActionLabel(target: GitResetTarget, capitalize = false): string {
	const label = target.kind === "amended-commit"
		? "roll back amended commit"
		: `reset ${countLabel(target.commitCount, "commit", "commits")}`;
	return capitalize ? `${label[0]!.toUpperCase()}${label.slice(1)}` : label;
}

export function buildRestoreActions(filesChanged: number, resetTarget?: GitResetTarget): RestoreAction[] {
	const files = countLabel(filesChanged, "file", "files");
	const reset = resetTarget ? gitResetActionLabel(resetTarget) : undefined;
	const actions: RestoreAction[] = [];
	const restoreCode = filesChanged > 0;
	const filesNote = restoreCode ? ` (${files})` : "";

	actions.push(
		{
			label: `${SUMMARIZE_FROM_BOTTOM}${filesNote}`,
			restoreCode,
			restoreConversation: true,
			resetGit: false,
			conversationMode: SUMMARIZE_FROM_BOTTOM,
		},
		{
			label: `${SUMMARIZE_FROM_UP}${filesNote}`,
			restoreCode,
			restoreConversation: true,
			resetGit: false,
			conversationMode: SUMMARIZE_FROM_UP,
		},
		{
			label: `${CURRENT_BEHAVIOUR}${filesNote}`,
			restoreCode,
			restoreConversation: true,
			resetGit: false,
			conversationMode: CURRENT_BEHAVIOUR,
		},
	);

	if (filesChanged > 0) {
		if (reset) {
			actions.push({
				label: `Restore code and conversation, and ${reset}`,
				restoreCode: true,
				restoreConversation: true,
				resetGit: true,
				conversationMode: CURRENT_BEHAVIOUR,
			});
		}
		actions.push({
			label: `Restore code only (${files})`,
			restoreCode: true,
			restoreConversation: false,
			resetGit: false,
		});
		if (reset) {
			actions.push({
				label: `Restore code and ${reset}`,
				restoreCode: true,
				restoreConversation: false,
				resetGit: true,
			});
		}
	} else {
		if (resetTarget && reset) {
			actions.push(
				{
					label: `Restore conversation and ${reset}`,
					restoreCode: true,
					restoreConversation: true,
					resetGit: true,
					conversationMode: CURRENT_BEHAVIOUR,
				},
				{
					label: `${gitResetActionLabel(resetTarget, true)} only`,
					restoreCode: true,
					restoreConversation: false,
					resetGit: true,
				},
			);
		}
	}

	actions.push({ label: "Cancel", restoreCode: false, restoreConversation: false, resetGit: false, cancel: true });
	return actions;
}
