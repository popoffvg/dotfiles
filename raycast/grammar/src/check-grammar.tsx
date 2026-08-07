import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  Icon,
  Toast,
  getSelectedText,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { CheckResultView } from "./check-result";
import { checkGrammar, prefillEnabled } from "./grammar";

async function candidateText(): Promise<string> {
  try {
    const selected = await getSelectedText();
    if (selected.trim()) return selected;
  } catch {
    // No frontmost selection — fall back to the clipboard.
  }
  const clipboard = await Clipboard.readText();
  return clipboard?.trim() ? clipboard : "";
}

export default function CheckGrammarCommand() {
  const { push } = useNavigation();
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!prefillEnabled()) return;
    let cancelled = false;
    candidateText().then((value) => {
      if (!cancelled && value) setText(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (!text.trim()) {
      setError("Text cannot be empty");
      return;
    }
    setError(undefined);
    setIsLoading(true);

    const toast = await showToast({ style: Toast.Style.Animated, title: "Checking grammar…" });
    try {
      const result = await checkGrammar(text);
      toast.style = Toast.Style.Success;
      toast.title = result.fixes.length === 0 ? "No mistakes found" : `${result.fixes.length} fix topic(s)`;
      push(<CheckResultView result={result} />);
    } catch (failure) {
      toast.style = Toast.Style.Failure;
      toast.title = "Check failed";
      toast.message = failure instanceof Error ? failure.message : String(failure);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Check Grammar"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Check" icon={Icon.Check} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="text"
        title="Text"
        placeholder="Paste the text to check — multiple lines are kept as they are"
        value={text}
        error={error}
        onChange={(value) => {
          setText(value);
          if (error) setError(undefined);
        }}
        enableMarkdown={false}
        autoFocus
      />
      <Form.Description text="Runs claude -p with the haiku model and appends every fix topic to the topic log." />
    </Form>
  );
}
