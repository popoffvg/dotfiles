--require'nvim-treesitter.install'.compilers = {"musl-gcc"}
--require'nvim-treesitter.parsers'.command_extra_args = {["musl-gcc"] = {"-static-libgcc"}}

require("nvim-treesitter.configs").setup({
	-- One of "all", "maintained" (parsers with maintainers), or a list of languages
	ensure_installed = {
		"go",
		"bash",
		--	"dockerfile",
		"glsl",
		"hcl",
		"javascript",
		"json",
		--	"lua",
		"toml",
		"typescript",
		--	"vim",
		"yaml",
		"python",
		"markdown",
		"markdown_inline",
		"proto",
		"sql",
		"graphql",
		"php",
	},
	incremental_selection = {
		enable = true,
		keymaps = {
			init_selection = "gnn", -- set to `false` to disable one of the mappings
			node_incremental = "grn",
			scope_incremental = "grc",
			node_decremental = "grm",
		},
	},
	textsubjects = {
		enable = true,
		prev_selection = ",", -- (Optional) keymap to select the previous selection
		keymaps = {
			["."] = "textsubjects-smart",
			[";"] = "textsubjects-container-outer",
			["i;"] = "textsubjects-container-inner",
		},
	},
	textobjects = {
		select = {
			enable = true,
			keymaps = {
				-- Your custom capture.
				["ip"] = "@parameter.inner",
				["ap"] = "@parameter.outer",
				["aa"] = "@assignment.outer",
				["ai"] = "@assignment.inner",
				["al"] = "@assignment.lhs",
				["ar"] = "@assignment.rhs",
				["as"] = "@statement.outer",
				["is"] = "@statement.inner",
			},
		},
		move = {
			enable = true,
			set_jumps = true,
			goto_next = {
				-- ["]]"] = "@conditional.outer",
				["]f"] = "@function.outer",
			},
			goto_previous = {
				-- ["[["] = "@conditional.outer",
				["[f"] = "@function.outer",
			},
		},
	},
	-- Install languages synchronously (only applied to `ensure_installed`)
	sync_install = true,

	highlight = {
		enable = true,
		additional_vim_regex_highlighting = false,
	},
	playground = { enable = true },
	query_linter = {
		enable = true,
		use_virtual_text = true,
		lint_events = { "BufWrite", "CursorHold" },
	},
})
