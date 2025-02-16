return {

	{
		"echasnovski/mini.indentscope",
		version = false,
		config = function()
			require("mini.indentscope").setup()
		end,
	},
	{
		"echasnovski/mini.pairs",
		event = { "BufReadPre", "BufNewFile" },
		init = function()
			require("mini.pairs").setup()
		end,
	},
	{
		"echasnovski/mini.diff",
		init = function()
			require("mini.diff").setup()
		end,
	},
	{
		"echasnovski/mini.splitjoin",
		event = { "BufReadPre", "BufNewFile" },
		init = function()
			require("mini.splitjoin").setup()
		end,
	},
	{
		"echasnovski/mini.move",
		event = { "BufReadPre", "BufNewFile" },
		init = function()
			require("mini.move").setup({
				mappings = {
					left = "<S-Tab>",
					right = "<Tab>",
					down = "<S-j>",
					up = "<S-k>",

					line_left = "<S-Tab>",
					line_right = "<Tab>",
					line_down = "<S-j>",
					line_up = "<S-k>",
				},
			})
		end,
	},
	{
		"echasnovski/mini.operators",
		event = { "BufReadPre", "BufNewFile" },
		opts = {
			evaluate = {
				prefix = "<leader>c=",

				-- Function which does the evaluation
				func = nil,
			},

			-- Exchange text regions
			exchange = {
				prefix = "<leader>cx",

				-- Whether to reindent new text to match previous indent
				reindent_linewise = true,
			},

			-- Multiply (duplicate) text
			multiply = {
				prefix = "<leader>cm",

				-- Function which can modify text before multiplying
				func = nil,
			},

			-- Replace text with register
			replace = {
				prefix = "<leader>cp",

				-- whether to reindent new text to match previous indent
				reindent_linewise = true,
			},

			-- Sort text
			sort = {
				prefix = "<leader>cs",

				-- Function which does the sort
				func = nil,
			},
		},
	},
	{
		"echasnovski/mini.bracketed",
		init = function()
			require("mini.bracketed").setup({
				diagnostic = {
					options = {
						severity = vim.diagnostic.severity.ERROR,
					},
				},
			})
		end,
	},
	{
		"echasnovski/mini.pairs",
		event = { "BufReadPre", "BufNewFile" },
		init = function()
			require("mini.pairs").setup()
		end,
	},

	-- {
	-- 	"echasnovski/mini.trailspace",
	-- 	event = "BufWritePre",
	-- 	init = function()
	-- 		require("mini.trailspace").setup()
	-- 	end,
	-- },
	{
		"echasnovski/mini.surround",
		event = { "BufReadPre", "BufNewFile" },
		init = function()
			require("mini.surround").setup()
		end,
	},
	{
		{
			"echasnovski/mini.ai",
			event = { "BufReadPre", "BufNewFile" },
			init = function()
				require("mini.ai").setup()
			end,
		},
	},
}
