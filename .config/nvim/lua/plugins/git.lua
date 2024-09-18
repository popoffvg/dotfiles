return {
	{
		"ThePrimeagen/git-worktree.nvim",
		"TimUntersberger/neogit",
		"lewis6991/gitsigns.nvim",
		-- "https://github.com/tpope/vim-fugitive.git",
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
	-- {
	-- 	"APZelos/blamer.nvim",
	-- 	event = "VeryLazy",
	-- },
	-- {
	-- 	"sindrets/diffview.nvim",
	-- 	event = "VeryLazy",
	-- },
	{
		"akinsho/git-conflict.nvim",
		version = "*",
		config = function()
			require("git-conflict").setup()
			-- vim.api.nvim_create_autocmd("User", {
			-- 	pattern = "GitConflictDetected",
			-- 	callback = function()
			-- 		vim.notify("Conflict detected in " .. vim.fn.expand("<afile>"))
			-- 		vim.keymap.set("n", "cww", function()
			-- 			engage.conflict_buster()
			-- 			create_buffer_local_mappings()
			-- 		end)
			-- 	end,
			-- })
		end,
	},
	-- {
	-- 	"NeogitOrg/neogit",
	-- 	dependencies = {
	-- 		"nvim-lua/plenary.nvim", -- required
	-- 		"sindrets/diffview.nvim", -- optional - Diff integration
	--
	-- 		-- Only one of these is needed, not both.
	-- 		"nvim-telescope/telescope.nvim", -- optional
	-- 		"ibhagwan/fzf-lua", -- optional
	-- 	},
	-- 	config = true,
	-- },
	{
		"aaronhallaert/advanced-git-search.nvim",
		cmd = { "AdvancedGitSearch" },
		config = function()
			require("telescope").setup({
				extensions = {
					advanced_git_search = {
						-- Insert Config here
					},
				},
			})

			require("telescope").load_extension("advanced_git_search")
		end,
		dependencies = {
			-- Insert Dependencies here
		},
	},
	{ "sindrets/diffview.nvim" },
}
