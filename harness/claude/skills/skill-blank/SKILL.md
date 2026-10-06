---
name: skill-blank
description: Blank — rebuild a skill's words from one accepted output when the model copies the example and skips added rules.
---

# skill-blank

`skill-build` owns the file's shape. This skill owns the words, when those words make a model emit a document.

1. **Take one accepted output.** Use the output a reader accepted. When a scorer has already graded runs, use its high-scoring output, and take each miss from what it wrote about the low-scoring ones. Done when that text is in hand and every miss names a missing part.
2. **Replace the skill with a blank of that output.** The slots are the parts of the accepted output, one job each. A line added to the old skill leaves the old shape in place. Done when the accepted output fits the blank with nothing left over and nothing missing, and the old rule list is gone.
3. **Put one filled example under the blank.** A short invented source, then the output in the blank's shape, in the tense and order the blank asks for. Done when the example and the blank match on every slot.
4. **Name the sentence form in one line** beside the blank: `Write the sentences as <form>: "<one sentence in that form>."` Use a form the model already holds, and use that sentence in the example. Done when the line contains the form's name and one sentence, and the example matches that sentence.
5. **Bring every file the skill tells the model to open into the same shape.** Done when none of them shows a different tense, order, or placement of copied words.
6. **Give each miss from step 1 a slot.** A comparison has both sides. A two-part claim has both parts. A heading is a sentence a reader could mark true or false. Done when every miss has a slot and no heading is only a topic name.
7. **Try one slot change on a copy.** The check counts the misses from step 1. Trust a count only after the accepted output is clean on it and a rejected output shows its miss. Keep the copy that moves such a count and still carries every part the accepted output has. The slow judge is the scorer you already trust; run it on that copy only. Done when the judge moves the stuck score, or two tries leave the separating counts unchanged.
