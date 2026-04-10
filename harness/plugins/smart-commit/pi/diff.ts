/**
 * Unified diff parser and patch builder.
 *
 * parseUnifiedDiff: splits a `git diff HEAD` output into file sections and
 * individual hunks, assigning each hunk a stable ID (h1, h2, …).
 *
 * buildPatch: given a set of selected hunk IDs, reconstructs a valid unified
 * diff containing only those hunks. git-apply uses context-line matching so
 * original @@ offsets remain correct even when hunks are skipped.
 */

export interface Hunk {
	id: string; // "h1", "h2", …
	file: string; // relative file path (new path, or old path for deletes)
	header: string; // "@@ -10,3 +10,5 @@" (with optional trailing context label)
	fullHunkText: string; // header line + body lines (the complete hunk text)
	addedLines: number;
	removedLines: number;
	isNewFile: boolean;
	isDeletedFile: boolean;
	/** First few changed lines for LLM context (max SNIPPET_LINES). */
	snippet: string;
}

export interface FileDiff {
	file: string;
	/** Everything from "diff --git …" up to (but not including) the first "@@" line. */
	fileHeader: string;
	isNewFile: boolean;
	isDeletedFile: boolean;
	hunks: Hunk[];
}

export interface ParsedDiff {
	files: FileDiff[];
	/** Flat list in document order, IDs h1, h2, … */
	hunks: Hunk[];
	hunkMap: Map<string, Hunk>;
}

const SNIPPET_LINES = 6;

/**
 * Parse a unified diff string into structured files and hunks.
 *
 * @param text     Raw `git diff HEAD` output.
 * @param startId  First numeric suffix to use for hunk IDs (default 1).
 *                 Pass the previous total hunk count + 1 when parsing diffs
 *                 from multiple repos so IDs stay globally unique.
 */
export function parseUnifiedDiff(text: string, startId = 1): ParsedDiff {
	// Split on "diff --git" to get per-file sections.
	const fileSections = text.split(/^(?=diff --git )/m).filter(Boolean);

	const allHunks: Hunk[] = [];
	const hunkMap = new Map<string, Hunk>();
	const files: FileDiff[] = [];
	let hunkCounter = startId;

	for (const section of fileSections) {
		const isNewFile = /^new file mode/m.test(section);
		const isDeletedFile = /^deleted file mode/m.test(section);

		// Determine canonical file path.
		let filePath: string;
		if (isDeletedFile) {
			const m = section.match(/^--- a\/(.+)$/m);
			filePath = m ? m[1].trimEnd() : "unknown";
		} else {
			const m = section.match(/^\+\+\+ b\/(.+)$/m);
			if (!m) continue; // binary / weird — skip
			filePath = m[1].trimEnd();
		}

		// Split file header from hunk bodies.
		// The first "@@ " appears after a newline.
		const firstHunkIdx = section.indexOf("\n@@");
		const fileHeader = firstHunkIdx >= 0 ? section.slice(0, firstHunkIdx + 1) : section;
		const hunksPart = firstHunkIdx >= 0 ? section.slice(firstHunkIdx + 1) : "";

		// Each hunk starts with "@@".
		const hunkTexts = hunksPart.split(/^(?=@@)/m).filter((s) => s.startsWith("@@"));

		const fileHunks: Hunk[] = [];
		for (const hunkText of hunkTexts) {
			const headerMatch = hunkText.match(/^(@@ .+? @@[^\n]*)/);
			if (!headerMatch) continue;
			const header = headerMatch[1];

			const lines = hunkText.split("\n");
			let added = 0;
			let removed = 0;
			const snippetLines: string[] = [];

			for (const line of lines.slice(1)) {
				if (line.startsWith("+")) {
					added++;
					if (snippetLines.length < SNIPPET_LINES) snippetLines.push(line);
				} else if (line.startsWith("-")) {
					removed++;
					if (snippetLines.length < SNIPPET_LINES) snippetLines.push(line);
				}
			}

			const id = `h${hunkCounter++}`;
			const hunk: Hunk = {
				id,
				file: filePath,
				header,
				fullHunkText: hunkText,
				addedLines: added,
				removedLines: removed,
				isNewFile,
				isDeletedFile,
				snippet: snippetLines.join("\n"),
			};

			fileHunks.push(hunk);
			allHunks.push(hunk);
			hunkMap.set(id, hunk);
		}

		files.push({ file: filePath, fileHeader, isNewFile, isDeletedFile, hunks: fileHunks });
	}

	return { files, hunks: allHunks, hunkMap };
}

/**
 * Build a partial unified diff containing only the selected hunks.
 * For each file that has at least one selected hunk, emits the file header
 * followed by those hunks in original order.
 *
 * git-apply adjusts the old-file position for each hunk by accumulating the
 * deltas of previously applied hunks in the same file, so the original @@
 * offsets remain valid even when intermediate hunks are omitted.
 */
export function buildPatch(files: FileDiff[], selectedHunkIds: Set<string>): string {
	const parts: string[] = [];

	for (const file of files) {
		const selected = file.hunks.filter((h) => selectedHunkIds.has(h.id));
		if (selected.length === 0) continue;

		parts.push(file.fileHeader);
		for (const hunk of selected) {
			// Ensure hunk text ends with a newline so hunks don't bleed together.
			const text = hunk.fullHunkText.endsWith("\n") ? hunk.fullHunkText : hunk.fullHunkText + "\n";
			parts.push(text);
		}
	}

	return parts.join("");
}
