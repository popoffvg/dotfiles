# Move the Grammar Raycast extension to a local T5 model

## Context

The Raycast extension `raycast/grammar` checks grammar with `claude -p --model haiku` through `~/.claude/scripts/grammar-check.sh`. Claude gives two things: the corrected text and a list of mistake topics. The topics go to `~/ctx/grammar/topics.tsv`, and the "Grammar Fix Topics" command shows them.

You asked to change it to `ollama run hf.co/pszemraj/flan-t5-large-grammar-synthesis:Q6_K`. That does not work: Ollama 0.33.3 loads the model, but every call gives an empty answer. llama.cpp can run the same model file, and it gives corrected text only. It gives no topics.

Answer 2 items. 1 item is for your information. I did not change any code.

```
today:     text ──> grammar-check.sh ──> claude haiku ──> corrected text + topics ──> topics.tsv
asked:     text ──> ollama (T5)      ──> ""  (empty, fails)
possible:  text ──> llama-simple (T5, same GGUF file) ──> corrected text only
```

## Terms

- **T5** — an encoder-decoder model type. The model reads the full input first (encoder), then writes the output (decoder).
- **GGUF** — the model file format that Ollama and llama.cpp use. Ollama keeps the file as a blob in `~/.ollama/models/blobs/`.
- **llama-simple** — a small llama.cpp program that runs one prompt and prints the result. Installed now with `brew install llama.cpp`.
- **topic** — a lowercase mistake type, for example `missing-article`. Claude writes one per mistake kind. Each topic becomes one row in `topics.tsv`.

## Items

### 1. [decide] Which backend runs the check

- **Source:** my tests in this session, with `ollama run`, `/api/generate` and `llama-simple`.
- **Detail:** Pick the program that gives the corrected text.

  Ollama returns `"response":""` with `eval_count: 1`. The model writes the end token first, because the Ollama server does not run the T5 encoder step. Raw mode, `temperature: 0`, and an added `</s>` gave the same result. `llama-simple -m <blob> -n 128 "<text>"` works and finishes in about 0.7 s. The results of the T5 model through llama-simple:

  | Input | Output |
  | --- | --- |
  | He buyed a apple and eat it. | He bought an apple and ate it. — correct |
  | I want to check is this commit pass the tests before merge in main branch. | …if this commit passes the tests before **attempting to** merge into the main branch. — correct, but it adds words |
  | The function return error when file not exist, so we need handle it. | no change — wrong |
  | she go to school yesterday and buyed a apple. i has two cat. | …bought **a new sweater**. I have two cats. — it changes the meaning |

  | Option | Runs where | Quality | Topics possible |
  | --- | --- | --- | --- |
  | A — llama-simple, same T5 model | local, ~0.7 s | as in the table above | no |
  | B — Ollama, a decoder model (for example `phi4-mini`, already pulled) | local | not tested | yes, with a prompt |
  | C — keep claude haiku | network | good | yes |

- **Recommended:** A. It is the model you asked for, and it runs locally. The script finds the GGUF file with `ollama show --modelfile`, so you do not download it a second time.

  The table above is the reason to refuse A: the T5 model sometimes changes the meaning. If this is not acceptable, pick C.

**Answer:** A

---

### 2. [decide] What happens to the topic log

- **Source:** `raycast/grammar/src/grammar-topics.tsx`, `harness/claude/scripts/grammar-check.sh` (the `awk` block writes `topics.tsv`).
- **Detail:** Decide what the "Grammar Fix Topics" command shows when the model gives no topics.

  Today each row in `topics.tsv` is `date<TAB>topic<TAB>rule explanation<TAB>wrong -> fixed`. The T5 model gives only the corrected text. This item applies only if you pick A in item 1.

  | Option | Row in topics.tsv | Extra cost |
  | --- | --- | --- |
  | A — log word diffs | `date<TAB>fix<TAB><TAB>buyed a apple -> bought an apple` | none; no rule names, so the Topics view groups all rows under `fix` |
  | B — remove topics | none; the "Grammar Fix Topics" command is deleted | none |
  | C — T5 fixes, claude haiku names the topics | as today | network and ~5 s for each check |

- **Recommended:** B. Without rule names, the Topics view shows one group, so it does not help you find the mistakes you repeat.

  If you want to keep a record of your mistakes, pick C. It keeps the log as useful as today.

**Answer:** T5 fixes, and after if there are any mistakes, save the text for further processing, I do it later

---

### 3. [info] llama.cpp is installed now

- **Source:** `brew install llama.cpp` in this session (version 0.5.0, in `/opt/homebrew/bin`).
- **Detail:** I installed it to test the model. If you pick B or C in item 1, you can remove it with `brew uninstall llama.cpp`. If you pick A, add it to the Ansible package list.

## Not checked

- A decoder model through Ollama (item 1, option B): I did not test its quality.
- Inputs longer than 512 tokens: the T5 context is 512 tokens, so a long text must be split. I did not test this.
- Beam search (the model card recommends `num_beams=2`): llama-simple has no beam search, so the quality can be lower than on the model card.
- Why `llama-completion` took 26 s for the same input, while `llama-simple` took 0.7 s.
