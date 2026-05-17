\# Channels

\## Quick start

Channels are short configuration recipes that typically dictate what \`tv\` should search through and what's displayed on the screen along with various other options.

Any given channel consists of a single TOML file.

\*\*Example\*\*: the default \`files\` channel

\`\`\`toml
\[metadata\]
name = "files"
description = "A channel to select files and directories"
requirements = \["fd", "bat"\]

\[source\]
command = "fd -t f"

\[preview\]
command = "bat -n --color=always '{}'"
env = { BAT\_THEME = "ansi" }

\[keybindings\]
shortcut = "f1"
\`\`\`

\## Default location on your system

Channels live in the \`cable\` directory inside your \[television configuration directory\](./02-configuration.md).

\*\*Example\*\*:

\`\`\`
/home/user/.config/television
├── config.toml
└── cable
    ├── files.toml
    ├── env.toml
    ├── alias.toml
    ├── git-repos.toml
    └── text.toml
\`\`\`

\## Community-maintained channels

The repository hosts a list of community-maintained channels which you can get and install to your cable directory using:

\`\`\`sh
tv update-channels
\`\`\`

\## Invocation

Channels may be invoked:

1\. directly from the cli:

\`\`\`
tv files
\`\`\`

2\. using the remote control:
 !\[tv remote\](../../assets/tv-files-remote.png)

3\. on the fly:

\`\`\`
tv --source-command 'fd -t f .' --preview-command 'bat -n --color=always {}' --preview-size 70
\`\`\`

\## Creating your own channels

Create a new TOML file in your cable directory:

\`\`\`sh
touch ~/.config/television/cable/my-awesome-channel.toml
\`\`\`

Fill out the minimum required fields:

\`\`\`toml
\[metadata\]
name = "my-awesome-channel"

\[source\]
command = "aws s3 ls my-bucket"
\`\`\`

Launch \`tv\` with your new channel (or select it via the remote control):

\`\`\`sh
tv my-awesome-channel
\`\`\`

The complete channel format spec can be found below.

\## Channel specification

\### high-level sections

\`\`\`toml
\[metadata\]
\# general channel information

\[source\]
\# this defines what we're searching through

\[preview\]
\# for each result, maybe display a preview

\[ui\]
\# customize the UI

\[keybindings\]
\# customize keybindings

\[actions\]
\# define external actions
\`\`\`

\### \`\[metadata\]\`

\`\`\`toml
\[metadata\]
name = "text"
description = "A short description about what my channel does"
requirements = \["rg", "bat"\] # any binary requirements my channel needs
\`\`\`

\### \`\[source\]\`

\`\`\`toml
\[source\]
command = "rg . --no-heading --line-number --colors 'match:fg:white' --colors 'path:fg:blue' --color=always"
\# display = "\[{split:\\\::..2}\]\\t{split:\\\::2}" # what's displayed in the UI (incompatible with \`ansi = true\`)
output = "{strip\_ansi\|split:\\\::..2}"
ansi = true # whether the results are ANSI formatted
\`\`\`

\##### Multiple Source Commands (Source Cycling)

You can specify multiple source commands in a channel, allowing users to cycle between different search variations:

\`\`\`toml
\[source\]
command = \["fd -t f", "fd -t f -H"\] # First shows normal files, second includes hidden files
\`\`\`

When multiple commands are configured:

\- Only the first command runs initially
\- Press `Ctrl` + `S` (default keybinding for \`cycle\_sources\`) to switch between commands

\*\*Note\*\*: This feature is currently only available in channel mode (not available when using \`--source-command\` from the CLI).

\##### Sorting Options

You can control how results are sorted using two fields in the \`\[source\]\` section:

\`\`\`toml
\[source\]
command = "cat ~/.bash\_history"
no\_sort = true # preserve the original order from the source command
\# frecency = false # disable frecency-based ranking for this channel
\`\`\`

\- \`no\_sort\` (default: \`false\`): When set to \`true\`, disables both match-quality sorting and frecency, preserving the exact order provided by the source command. This is also available as the \`--no-sort\` CLI flag.
\- \`frecency\` (default: \`true\`): When set to \`false\`, disables frecency ranking for this channel while keeping match-quality sorting. This is useful for channels where the source order is meaningful (e.g., shell history, git log). See \[Frecency Sorting\](../advanced/02-tips-and-tricks.md#frecency-sorting) for details on how frecency works.

\### \`\[preview\]\`

\`\`\`toml
\[preview\]
command = 'bat -n --color=always {split:\\::0}'
env = { BAT\_THEME = "ansi" } # extra envs to use when generating preview
offset = '{split:\\::1}' # extracts preview offset information from the entry
\`\`\`

\### \`\[ui\]\`

\`\`\`toml
\[ui\]
ui\_scale = 80 # use 80% of available screen
layout = "portrait"
input\_bar\_position = "bottom"
input\_header = "Search:"

\[ui.preview\_panel\]
size = 40 # 40%
header = "{}" # show the currently selected entry
footer = "my awesome footer"
scrollbar = false

\[ui.status\_bar\]
separator\_open = "<"
separator\_close = ">"

\[ui.help\_panel\]
show\_categories = true

\[ui.remote\_control\]
show\_channel\_descriptions = true
sort\_alphabetically = true

\# UI panel visibility (individual control)
\[ui.preview\_panel\]
hidden = false

\[ui.status\_bar\]
hidden = false

\[ui.help\_panel\]
hidden = true

\[ui.remote\_control\]
\# disabled = false # uncomment to disable remote control for this channel
\`\`\`

\### \`\[keybindings\]\`

\`\`\`toml
\[keybindings\]
shortcut = "f1" # \`f1\` will automatically switch to this channel

quit = \["esc", "ctrl-c"\]
select\_next\_entry = \["down", "ctrl-j"\]
select\_prev\_entry = \["up", "ctrl-k"\]
confirm\_selection = "enter"
\`\`\`

See the \[Actions Reference\](../reference/02-actions.md) for a list of available actions.

\### \`\[actions\]\`

External actions allow you to define custom commands that can be executed on
selected entries. Actions are triggered via keybindings using the
\`actions:\` syntax.

\#### Action specification:

\| Field \| Description \|
\| \-\-\-\-\-\-\-\-\-\-\-\-\- \| \-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\- \|
\| \`description\` \| Optional description of what the action does \|
\| \`command\` \| Command template to execute (supports \[templating syntax\](#templating-syntax)) \|
\| \`mode\` \| Execution mode: \`fork\` runs command in a subprocess, allowing you to return to tv upon completion (default); \`execute\` runs command and becomes the new process \|
\| \`separator\` \| Character(s) to use when joining \*\*multiple selected entries\*\* when using complex template processing; depending on the entries content it might be beneficial to change to another one (default: \`" "\` - space) \|

\#### Example:

\`\`\`toml
\[actions.edit\]
description = "Open selected files in editor"
command = "nvim {}"
\# Single file: nvim 'file1.txt'
\# Multiple files: nvim 'file1.txt' 'file2.txt'
\# Files with quotes: nvim 'file\\'s name.txt'
\`\`\`

\#### Advanced Template Processing:

For complex formatting needs, use the full \[templating syntax\](#templating-syntax):

\`\`\`toml
\[keybindings\]
ctrl-e = "actions:edit"
f2 = "actions:view"

\[actions.edit\]
description = "Open selected files in editor"
command = "nvim {split:\\\n:..\|map:{append:'\|prepend:'}\|join: }"
mode = "execute"
separator = "\\n"
\# example: inputs "file1" and "file 2" will generate the command
\# nvim 'file1' 'file 2'
\# Note: we added quotes at command level to avoid shell artifacts

\[actions.view\]
description = "View files with less"
command = "less {}"
mode = "fork"
separator = " "
\# example: inputs "file1" and "file 2" will generate the command
\# less file1 file 2
\# Note: 3 args here, instead of 2
\`\`\`

\## Templating syntax

Several channel fields can be formatted dynamically using the syntax described in the \[string-pipeline\](https://docs.rs/string\_pipeline/0.12.0/string\_pipeline/) crate.

Here's a quick TLDR if you're feeling lazy:

\*\*Basic transformations:\*\*

\`\`\`bash
\# Extract middle items: "a,b,c,d,e"
"{split:,:1..3}"
\# Output: "b,c"

\# Clean and format names: " john , jane , bob "
'{split:,:..\|map:{trim\|upper\|append:!}}'
\# Output: "JOHN!,JANE!,BOB!"

\# Extract numbers and pad with zeros: "item1,thing22,stuff333"
'{split:,:..\|map:{regex\_extract:\\d+\|pad:3:0:left}}'
\# Output: "001,022,333"
\`\`\`

\*\*More niche use-cases:\*\*

\`\`\`bash
\# Filter files, format as list: "app.py,readme.md,test.py,data.json"
'{split:,:..\|filter:\\.py$\|sort\|map:{prepend:• }\|join:\\n}'
\# Output: "• app.py\\n• test.py"

\# Extract domains from URLs: "https://github.com,https://google.com"
'{split:,:..\|map:{regex\_extract://(\[^/\]+):1\|upper}}'
\# Output: "GITHUB.COM,GOOGLE.COM"

\# Debug complex processing: "apple Banana cherry Date"
"{split: :..\|filter:^\[A-Z\]\|sort:desc}"
\# Output: Date,Banana
\`\`\`