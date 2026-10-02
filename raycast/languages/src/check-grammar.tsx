import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { candidateText } from "./candidate-text";
import { CheckResultView } from "./check-result";
import { checkWithLanguageTool } from "./languagetool";
import { languagesPreferences } from "./preferences";
import { saveCheck } from "./saved-check";

export default function CheckGrammarCommand() {
  const { push } = useNavigation();
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!languagesPreferences().prefill) return;
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

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Checking grammar…",
    });
    try {
      const result = await checkWithLanguageTool(text);
      const savedPath =
        result.mistakes.length > 0
          ? saveCheck(languagesPreferences().inboxDir, result)
          : undefined;
      toast.style = Toast.Style.Success;
      toast.title =
        result.mistakes.length === 0
          ? "No mistakes found"
          : `${result.mistakes.length} mistake(s) fixed`;
      push(<CheckResultView result={result} savedPath={savedPath} />);
    } catch (failure) {
      toast.style = Toast.Style.Failure;
      toast.title = "Check failed";
      toast.message =
        failure instanceof Error ? failure.message : String(failure);
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
          <Action.SubmitForm
            title="Check"
            icon={Icon.Check}
            onSubmit={submit}
          />
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
      <Form.Description text="LanguageTool fixes the grammar and saves the rule of each mistake to the inbox. phi4-mini then suggests a polished version." />
    </Form>
  );
}
