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
import { languagesPreferences } from "./preferences";
import { TranslateResultView } from "./translate-result";
import { translateWithVocab } from "./vocab";

export default function TranslateCommand() {
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
      title: "Translating…",
    });
    try {
      const pair = await translateWithVocab(text.trim());
      toast.style = Toast.Style.Success;
      toast.title = pair.dup ? "Already in vocab" : "Added to vocab";
      push(<TranslateResultView pair={pair} />);
    } catch (failure) {
      toast.style = Toast.Style.Failure;
      toast.title = "Translation failed";
      toast.message =
        failure instanceof Error ? failure.message : String(failure);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Translate"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Translate"
            icon={Icon.Globe}
            onSubmit={submit}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="text"
        title="Text"
        placeholder="Paste English or Russian text"
        value={text}
        error={error}
        onChange={(value) => {
          setText(value);
          if (error) setError(undefined);
        }}
        enableMarkdown={false}
        autoFocus
      />
      <Form.Description text="vocab translates RU↔EN with Google Translate and appends the pair to the vocab file." />
    </Form>
  );
}
