import { Form, Action, ActionPanel, showToast, Toast } from "@raycast/api";
import { renameSpace, Space } from "./hammerspoon";

interface Props {
  space: Space;
  onDone: () => void;
}

export function RenameForm({ space, onDone }: Props) {
  return (
    <Form
      navigationTitle={`Rename: ${space.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save"
            onSubmit={async (values: { name: string }) => {
              if (!values.name.trim()) {
                await showToast({ style: Toast.Style.Failure, title: "Name cannot be empty" });
                return;
              }
              renameSpace(space.id, values.name.trim());
              await showToast({ style: Toast.Style.Success, title: `Renamed to ${values.name.trim()}` });
              onDone();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Space Name" defaultValue={space.name} autoFocus />
    </Form>
  );
}
