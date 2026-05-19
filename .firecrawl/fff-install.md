[Skip to content](https://github.com/dmtrKovalenko/fff/blob/main/install-mcp.sh#start-of-content)

You signed in with another tab or window. [Reload](https://github.com/dmtrKovalenko/fff/blob/main/install-mcp.sh) to refresh your session.You signed out in another tab or window. [Reload](https://github.com/dmtrKovalenko/fff/blob/main/install-mcp.sh) to refresh your session.You switched accounts on another tab or window. [Reload](https://github.com/dmtrKovalenko/fff/blob/main/install-mcp.sh) to refresh your session.Dismiss alert

{{ message }}

[dmtrKovalenko](https://github.com/dmtrKovalenko)/ **[fff](https://github.com/dmtrKovalenko/fff)** Public

- [Notifications](https://github.com/login?return_to=%2FdmtrKovalenko%2Ffff) You must be signed in to change notification settings
- [Fork\\
279](https://github.com/login?return_to=%2FdmtrKovalenko%2Ffff)
- [Star\\
6.1k](https://github.com/login?return_to=%2FdmtrKovalenko%2Ffff)


## Collapse file tree

## Files

main

Search this repository(forward slash)` forward slash/`

/

# install-mcp.sh

Copy path

Blame

More file actions

Blame

More file actions

## Latest commit

[![dmtrKovalenko](https://avatars.githubusercontent.com/u/16926049?v=4&size=40)](https://github.com/dmtrKovalenko)[dmtrKovalenko](https://github.com/dmtrKovalenko/fff/commits?author=dmtrKovalenko)

[feat(mcp): Make install script understand upgrade use case](https://github.com/dmtrKovalenko/fff/commit/fcdf4a9172fba824ca6834731b93b74eba51d1c3)

success

2 months agoMar 13, 2026

[fcdf4a9](https://github.com/dmtrKovalenko/fff/commit/fcdf4a9172fba824ca6834731b93b74eba51d1c3) · 2 months agoMar 13, 2026

## History

[History](https://github.com/dmtrKovalenko/fff/commits/main/install-mcp.sh)

Open commit details

[View commit history for this file.](https://github.com/dmtrKovalenko/fff/commits/main/install-mcp.sh) History

executable file

·

272 lines (232 loc) · 7.21 KB

/

# install-mcp.sh

Top

## File metadata and controls

- Code

- Blame


executable file

·

272 lines (232 loc) · 7.21 KB

[Raw](https://github.com/dmtrKovalenko/fff/raw/refs/heads/main/install-mcp.sh)

Copy raw file

Download raw file

Open symbols panel

Edit and raw actions

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

23

24

25

26

27

28

29

30

31

32

33

34

35

36

37

38

39

40

41

42

43

44

45

46

47

48

49

50

51

52

53

54

55

56

57

58

59

60

61

62

63

64

65

66

67

68

69

70

71

72

73

74

75

76

77

78

79

80

81

82

83

84

85

86

87

88

89

90

91

92

93

94

95

96

97

98

99

100

101

102

103

104

105

106

107

108

109

110

111

112

113

114

115

116

117

118

119

120

121

122

123

124

125

126

127

128

129

130

131

132

133

134

135

136

137

138

139

140

141

142

143

144

145

146

147

148

149

150

199

200

201

202

203

204

205

206

207

208

209

210

211

212

213

214

215

216

217

218

219

220

221

222

223

224

225

226

227

228

229

230

231

232

233

234

235

236

237

238

239

240

241

242

243

244

245

246

247

248

249

250

251

252

253

254

255

256

257

258

259

260

261

262

263

264

265

266

267

268

269

270

271

272

#!/usr/bin/env bash

set -eo pipefail

# FFF MCP Server installer

# Usage: curl -fsSL https://raw.githubusercontent.com/dmtrKovalenko/fff.nvim/main/install-mcp.sh \| bash

REPO="dmtrKovalenko/fff.nvim"

BINARY\_NAME="fff-mcp"

INSTALL\_DIR="${FFF\_MCP\_INSTALL\_DIR:-$HOME/.local/bin}"

info() { printf'\\033\[1;34m%s\\033\[0m\\n'"$\*"; }\
\
success() { printf'\\033\[1;38;5;208m%s\\033\[0m\\n'"$\*"; }\
\
warn() { printf'\\033\[1;33m%s\\033\[0m\\n'"$\*"; }\
\
error() { printf'\\033\[1;31mError: %s\\033\[0m\\n'"$\*">&2;exit 1; }\
\
# Print JSON with syntax highlighting via jq if available, plain otherwise\
\
print\_json() {\
\
ifcommand -v jq &>/dev/null;then\
\
echo"$1"\| jq .\
\
else\
\
echo"$1"\
\
fi\
\
}\
\
detect\_platform() {\
\
local os arch target\
\
os="$(uname -s)"\
\
arch="$(uname -m)"\
\
case"$os"in\
\
Linux)\
\
# Prefer musl (static) for maximum compatibility\
\
case"$arch"in\
\
x86\_64) target="x86\_64-unknown-linux-musl" ;;\
\
aarch64\|arm64) target="aarch64-unknown-linux-musl" ;;\
\
\*) error "Unsupported architecture: $arch" ;;\
\
esac\
\
;;\
\
Darwin)\
\
case"$arch"in\
\
x86\_64) target="x86\_64-apple-darwin" ;;\
\
aarch64\|arm64) target="aarch64-apple-darwin" ;;\
\
\*) error "Unsupported architecture: $arch" ;;\
\
esac\
\
;;\
\
MINGW\*\|MSYS\*\|CYGWIN\*)\
\
case"$arch"in\
\
x86\_64) target="x86\_64-pc-windows-msvc" ;;\
\
aarch64\|arm64) target="aarch64-pc-windows-msvc" ;;\
\
\*) error "Unsupported architecture: $arch" ;;\
\
esac\
\
;;\
\
\*) error "Unsupported OS: $os" ;;\
\
esac\
\
echo"$target"\
\
}\
\
get\_latest\_release\_tag() {\
\
local target="$1"\
\
local releases\_json\
\
releases\_json=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases") \\
\
\|\| error "Failed to fetch releases from https://github.com/${REPO}/releases"\
\
# Find the first release that contains an fff-mcp binary for our platform\
\
local tag\
\
tag=$(echo "$releases\_json" \\
\
\| grep -oE '"(tag\_name\|name)": \*"\[^"\]\*"' \\
\
\| awk -v target="fff-mcp-${target}"'\
\
/"tag\_name":/ { gsub(/.\*": \*"\|"/, ""); current\_tag = $0; next }\
\
/"name":/ && index($0, target) { print current\_tag; exit }\
\
')\
\
if \[ -z"$tag" \];then\
\
error "No release found containing fff-mcp binaries for ${target}. The MCP build may not have been released yet."\
\
fi\
\
echo"$tag"\
\
}\
\
download\_binary() {\
\
local target="$1"\
\
local tag="$2"\
\
local ext=""\
\
case"$target"in\
\
\*windows\*) ext=".exe" ;;\
\
esac\
\
local filename="${BINARY\_NAME}-${target}${ext}"\
\
local url="https://github.com/${REPO}/releases/download/${tag}/${filename}"\
\
local checksum\_url="${url}.sha256"\
\
info "Downloading ${filename} from release ${tag}..."\
\
local tmp\_dir\
\
tmp\_dir="$(mktemp -d)"\
\
trap'rm -rf "$tmp\_dir"' EXIT\
\
if! curl -fsSL -o "${tmp\_dir}/${filename}""$url"2>/dev/null;then\
\
echo"">&2\
\
printf'\\033\[1;31mError: Failed to download binary for your platform.\\033\[0m\\n'>&2\
\
echo"">&2\
\
echo" URL: ${url}">&2\
\
echo" Release: ${tag}">&2\
\
echo" Platform: ${target}">&2\
\
echo"">&2\
\
echo"This likely means the MCP binary hasn't been built for this release yet.">&2\
\
echo"Check available releases at: https://github.com/${REPO}/releases">&2\
\
exit 1\
\
fi\
\
# Verify checksum if sha256sum is available\
\
ifcommand -v sha256sum &>/dev/null;then\
\
if curl -fsSL -o "${tmp\_dir}/${filename}.sha256""$checksum\_url"2>/dev/null;then\
\
info "Verifying checksum..."\
\
(cd "$tmp\_dir"&& sha256sum -c "${filename}.sha256") \\
\
\|\| error "Checksum verification failed!"\
\
else\
\
warn "Checksum file not available, skipping verification."\
\
fi\
\
fi\
\
# Install\
\
mkdir -p "$INSTALL\_DIR"\
\
mv "${tmp\_dir}/${filename}""${INSTALL\_DIR}/${BINARY\_NAME}${ext}"\
\
chmod +x "${INSTALL\_DIR}/${BINARY\_NAME}${ext}"\
\
if \[ "$IS\_UPDATE"!=true \];then\
\
success "Installed ${BINARY\_NAME} to ${INSTALL\_DIR}/${BINARY\_NAME}${ext}"\
\
fi\
\
}\
\
check\_path() {\
\
case":$PATH:"in\
\
\*":${INSTALL\_DIR}:"\*) return 0 ;;\
\
esac\
\
warn "${INSTALL\_DIR} is not in your PATH."\
\
echo""\
\
echo"Add it to your shell profile:"\
\
echo""\
\
local shell\_name\
\
shell\_name="$(basename "${SHELL:-bash}")"\
\
case"$shell\_name"in\
\
zsh)\
\
echo" echo 'export PATH=\\"${INSTALL\_DIR}:\\$PATH\\"' >\> ~/.zshrc"\
\
echo" source ~/.zshrc"\
\
;;\
\
echo"Add to ~/.config/opencode/opencode.json:"\
\
echo""\
\
print\_json '{\
\
"mcp": {\
\
"fff": {\
\
"type": "local",\
\
"command": \["fff-mcp"\],\
\
"enabled": true\
\
}\
\
}\
\
}'\
\
echo""\
\
fi\
\
# Codex\
\
ifcommand -v codex &>/dev/null;then\
\
found\_any=true\
\
success "\[Codex\] detected"\
\
echo""\
\
echo"codex mcp add fff -- fff-mcp"\
\
echo""\
\
fi\
\
if \[ "$found\_any"=false \];then\
\
echo"No AI coding assistants detected."\
\
echo""\
\
echo"Binary path: ${binary\_path}"\
\
echo""\
\
fi\
\
echo"Binary: ${binary\_path}"\
\
echo"Docs: https://github.com/${REPO}"\
\
echo""\
\
info "Tip: Add this to your CLAUDE.md or AGENTS.md to make AI use fff for all searches:"\
\
echo"\\""\
\
echo"Use the fff MCP tools for all file search operations instead of default tools."\
\
echo"\\""\
\
}\
\
main() {\
\
local target\
\
target="$(detect\_platform)"\
\
local existing\_binary="${INSTALL\_DIR}/${BINARY\_NAME}"\
\
IS\_UPDATE=false\
\
if \[ -x"$existing\_binary" \];then\
\
IS\_UPDATE=true\
\
info "Updating FFF MCP Server..."\
\
else\
\
info "Installing FFF MCP Server..."\
\
fi\
\
echo""\
\
info "Detected platform: ${target}"\
\
local tag\
\
tag="$(get\_latest\_release\_tag "$target")"\
\
download\_binary "$target""$tag"\
\
if \[ "$IS\_UPDATE"=true \];then\
\
echo""\
\
success "FFF MCP Server updated to ${tag}!"\
\
echo""\
\
else\
\
check\_path\
\
print\_setup\_instructions\
\
fi\
\
}\
\
main\
\
You can’t perform that action at this time.