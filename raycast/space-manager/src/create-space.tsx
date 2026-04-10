import { Form, Action, ActionPanel, showToast, Toast, popToRoot } from "@raycast/api";
import { createSpace, renameSpace } from "./hammerspoon";

export default function CreateSpaceCommand() {
  return (
    <Form
      navigationTitle="Create Space"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create"
            onSubmit={async (values: { name: string }) => {
              try {
                const newID = createSpace();
                if (values.name.trim()) {
                  renameSpace(newID, values.name.trim());
                }
                await showToast({ style: Toast.Style.Success, title: `Created: ${values.name.trim() || "Unnamed"}` });
                popToRoot();
              } catch {
                await showToast({ style: Toast.Style.Failure, title: "Failed to create space" });
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Space Name" placeholder="e.g. Work, Personal, Music" autoFocus />
    </Form>
  );
}
