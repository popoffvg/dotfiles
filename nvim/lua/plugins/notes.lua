return {
	"epwalsh/obsidian.nvim",
	version = "*", -- recommended, use latest release instead of latest commit
	-- lazy = true,
	ft = "markdown",
	-- Replace the above line with this if you only want to load obsidian.nvim for markdown files in your vault:
	-- event = {
	--   -- If you want to use the home shortcut '~' here you need to call 'vim.fn.expand'.
	--   -- E.g. "BufReadPre " .. vim.fn.expand "~" .. "/my-vault/**.md"
	--   "BufReadPre path/to/my-vault/**.md",
	--   "BufNewFile path/to/my-vault/**.md",
	-- },
	dependencies = {
		-- Required.
		"nvim-lua/plenary.nvim",
		"nvim-treesitter/nvim-treesitter",
	},
	config = function()
		require("nvim-treesitter.configs").setup({
			ensure_installed = { "markdown", "markdown_inline" },
			highlight = {
				enable = true,
			},
		})
		require("obsidian").setup({
			workspaces = {
				{
					name = "personal",
					path = "~/Documents/git/Z-Core",
				},
			},
			templates = {
				subdir = "Tempalates",
				date_format = "%Y-%m-%d-%a",
				time_format = "%H:%M",
			},
			mappings = {
				["fo"] = {
					action = function()
						return require("obsidian").util.gf_passthrough()
					end,
					opts = { noremap = false, expr = true, buffer = true },
				},
			},
		})
	end,
}
