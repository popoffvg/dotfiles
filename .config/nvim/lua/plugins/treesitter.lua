local ensure_installed = {
	"go",
	"bash",
	--	"dokerfile",
	"glsl",
	"hcl",
	"javascript",
	"json",
	"lua",
	"toml",
	"typescript",
	"vim",
	"yaml",
	"python",
	"markdown",
	"markdown_inline",
	"proto",
	"sql",
	"graphql",
	"php",
	"hurl",
}

local opts = {
	query_linter = {
		enable = true,
		use_virtual_text = false,
		lint_events = { "BufWrite", "CursorHold" },
	},
	ensure_installed = ensure_installed,
	incremental_selection = {
		enable = true,
		keymaps = {
			init_selection = "en", -- mnemonic [e]ntry
			node_incremental = "ea",
			scope_incremental = "es",
			node_decremental = "ed",
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
	playground = {
		enable = true,
		disable = {},
		updatetime = 25, -- Debounced time for highlighting nodes in the playground from source code
		persist_queries = true, -- Whether the query persists across vim sessions
		keybindings = {
			toggle_query_editor = "o",
			toggle_hl_groups = "i",
			toggle_injected_languages = "t",
			toggle_anonymous_nodes = "a",
			toggle_language_display = "I",
			focus_language = "f",
			unfocus_language = "F",
			update = "R",
			goto_node = "<cr>",
			show_help = "?",
		},
	},
}

return {
	{
		"nvim-treesitter/nvim-treesitter",
		build = ":TSUpdate",
		event = { "BufReadPre", "BufNewFile" },
		dependencies = {
			"nvim-treesitter/nvim-treesitter-textobjects",
			"JoosepAlviste/nvim-ts-context-commentstring",
			-- {
			-- -- show current function signature
			-- 	"nvim-treesitter/nvim-treesitter-context",
			-- 	config = function()
			-- 		vim.cmd([[
			--                 hi TreesitterContextBottom gui=underline guisp=Grey
			--          ]])
			-- 		vim.keymap.set("n", "[c", function()
			-- 			require("treesitter-context").go_to_context(vim.v.count1)
			-- 		end, { silent = true })
			-- 	end,
			-- },
		},

		config = function()
			require("nvim-treesitter.configs").setup(opts)

			-- MDX
			vim.filetype.add({
				extension = {
					mdx = "mdx",
				},
			})
			vim.treesitter.language.register("markdown", "mdx")
		end,
	},
}
