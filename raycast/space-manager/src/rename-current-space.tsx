import { Form, Action, ActionPanel, showToast, Toast, popToRoot } from "@raycast/api";
import { activeSpaceID, getSpaceName, renameSpace } from "./hammerspoon";

export default function RenameCurrentSpaceCommand() {
  const id = activeSpaceID();
  const currentName = getSpaceName(id);

  return (
    <Form
      navigationTitle="Rename Current Space"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save"
            onSubmit={async (values: { name: string }) => {
              if (!values.name.trim()) {
                await showToast({ style: Toast.Style.Failure, title: "Name cannot be empty" });
                return;
              }
              renameSpace(id, values.name.trim());
              await showToast({ style: Toast.Style.Success, title: `Renamed to ${values.name.trim()}` });
              popToRoot();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Space Name" defaultValue={currentName} placeholder="Enter name..." autoFocus />
    </Form>
  );
}
