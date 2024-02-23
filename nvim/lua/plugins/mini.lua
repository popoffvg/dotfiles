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
					left = "<S-h>",
					right = "<S-l>",
					down = "<S-j>",
					up = "<S-k>",

					line_left = "<S-h>",
					line_right = "<S-l>",
					line_down = "<S-j>",
					line_up = "<S-k>",
				},
			})
		end,
	},
	{
		"echasnovski/mini.trailspace",
		event = { "BufReadPre", "BufNewFile" },
		init = function()
			require("mini.trailspace").setup()
		end,
	},
	{
		"echasnovski/mini.surround",
		event = { "BufReadPre", "BufNewFile" },
		init = function()
			require("mini.surround").setup()
		end,
	},
}
