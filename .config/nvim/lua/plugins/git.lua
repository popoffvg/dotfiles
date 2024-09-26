return {
	-- {
	-- 	"ThePrimeagen/git-worktree.nvim",
	-- 	"TimUntersberger/neogit",
	-- 	"lewis6991/gitsigns.nvim",
	-- 	"https://github.com/tpope/vim-fugitive.git",
	-- 	{
	-- 		"pwntester/octo.nvim",
	-- 		event = "VeryLazy",
	-- 		config = function()
	-- 			require("octo").setup()
	-- 		end,
	-- 	},
	-- },
	{ "https://github.com/tpope/vim-fugitive.git" },
	{
		"ruifm/gitlinker.nvim",
		requires = "nvim-lua/plenary.nvim",
		config = function()
			-- <leader>gy get link
			require("gitlinker").setup({
				opts = {
					remote = nil, -- force the use of a specific remote
					-- adds current line nr in the url for normal mode
					add_current_line_on_normal_mode = true,
					-- callback for what to do with the url
					action_callback = require("gitlinker.actions").copy_to_clipboard,
					-- print the url after performing the action
					print_url = true,
				},
				callbacks = {
					["github.com"] = require("gitlinker.hosts").get_github_type_url,
					["gitlab.com"] = require("gitlinker.hosts").get_gitlab_type_url,
					["try.gitea.io"] = require("gitlinker.hosts").get_gitea_type_url,
					["codeberg.org"] = require("gitlinker.hosts").get_gitea_type_url,
					["bitbucket.org"] = require("gitlinker.hosts").get_bitbucket_type_url,
					["try.gogs.io"] = require("gitlinker.hosts").get_gogs_type_url,
					["git.sr.ht"] = require("gitlinker.hosts").get_srht_type_url,
					["git.launchpad.net"] = require("gitlinker.hosts").get_launchpad_type_url,
					["repo.or.cz"] = require("gitlinker.hosts").get_repoorcz_type_url,
					["git.kernel.org"] = require("gitlinker.hosts").get_cgit_type_url,
					["git.savannah.gnu.org"] = require("gitlinker.hosts").get_cgit_type_url,
				},
				-- default mapping to call url generation with action_callback
				mappings = "<leader>gy",
			})
		end,
	},
	-- {
	-- 	"APZelos/blamer.nvim",
	-- 	event = "VeryLazy",
	-- },
	-- {
	-- 	"akinsho/git-conflict.nvim",
	-- 	version = "*",
	-- 	config = function()
	-- 		require("git-conflict").setup()
	-- 		-- vim.api.nvim_create_autocmd("User", {
	-- 		-- 	pattern = "GitConflictDetected",
	-- 		-- 	callback = function()
	-- 		-- 		vim.notify("Conflict detected in " .. vim.fn.expand("<afile>"))
	-- 		-- 		vim.keymap.set("n", "cww", function()
	-- 		-- 			engage.conflict_buster()
	-- 		-- 			create_buffer_local_mappings()
	-- 		-- 		end)
	-- 		-- 	end,
	-- 		-- })
	-- 	end,
	-- },
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
