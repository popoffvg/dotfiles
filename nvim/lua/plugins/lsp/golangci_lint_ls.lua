return {
	default_config = {
		cmd = { "golangci-lint-langserver" },
		root_dir = require("lspconfig").util.root_pattern(".git", "go.mod"),
		init_options = {
			command = {
				"golangci-lint",
				"run",
				"--enable-all",
				"--disable",
				"lll",
				"--out-format",
				"json",
				"--issues-exit-code=1",
			},
		},
	},
}
