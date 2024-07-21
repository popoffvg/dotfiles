return {
	{
		"ThePrimeagen/git-worktree.nvim",
		"TimUntersberger/neogit",
		"lewis6991/gitsigns.nvim",
		"https://github.com/tpope/vim-fugitive.git",
		{
			"pwntester/octo.nvim",
			event = "VeryLazy",
			config = function()
				require("octo").setup()
			end,
		},
	},
	{
		"ruifm/gitlinker.nvim",
		requires = "nvim-lua/plenary.nvim",
		config = function()
			-- <leader>gy get link
			require("gitlinker").setup()
		end,
	},
	{
		"APZelos/blamer.nvim",
		event = "VeryLazy",
	},
	{
		"sindrets/diffview.nvim",
		event = "VeryLazy",
	},
	{
		"NeogitOrg/neogit",
		dependencies = {
			"nvim-lua/plenary.nvim", -- required
			"sindrets/diffview.nvim", -- optional - Diff integration

			-- Only one of these is needed, not both.
			"nvim-telescope/telescope.nvim", -- optional
			"ibhagwan/fzf-lua", -- optional
		},
		config = true,
	},
}
