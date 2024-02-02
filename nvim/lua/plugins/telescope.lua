local opts = { noremap = true, silent = true }
return {
	"nvim-telescope/telescope.nvim",
	dependecies = {
		"junegunn/fzf.vim",
		"ThePrimeagen/git-worktree.nvim",
		"nvim-telescope/telescope-live-grep-args.nvim",
		"gbprod/yanky.nvim",
		"nvim-lua/plenary.nvim",
	},
	config = function()
		local lga_actions = require("telescope-live-grep-args.actions")
		require("telescope").setup({
			defaults = {
				initial_mode = "insert",
				file_ignore_patterns = { "node%_modules", "%.git" },
				layout_config = {
					center = {
						preview_cutoff = 120,
						width = function(_, cols, _)
							if cols > 200 then
								return 170
							else
								return math.floor(cols * 0.87)
							end
						end,

						height = function(_, _, max_lines)
							return math.min(max_lines, 80)
						end,
					},
				},
				theme = "dropdown", -- use dropdown theme
			},

			extensions = {
				live_grep_args = {
					auto_quoting = true, -- enable/disable auto-quoting
					-- define mappings, e.g.
					mappings = { -- extend mappings
						i = {
							["<a-k>"] = lga_actions.quote_prompt(),
							["<a-f>"] = lga_actions.quote_prompt({ postfix = " --iglob " }),
						},
					},
					theme = "dropdown",
					preview = true,
				},
			},
			pickers = {
				lsp_references = {
					theme = "dropdown",
					show_line = false,
				},
				find_files = {
					theme = "dropdown",
					preview = false,
				},
			},
		})

		require("telescope").load_extension("fzf")
		require("telescope").load_extension("git_worktree")
		require("telescope").load_extension("live_grep_args")
		require("telescope").load_extension("yank_history")
		require("yanky.telescope.mapping").put("p")
		require("yanky.telescope.mapping").put("P")
		require("yanky.telescope.mapping").put("gp")
		require("yanky.telescope.mapping").put("gP")
		require("yanky.telescope.mapping").delete()
		-- require("yanky.telescope.mapping").set_register(regname) -- fill register {regname} with selected value
	end,
	keys = {
		{ "<leader>ff", ":Telescope find_files hidden=true preview=false<CR>", opts },
		{ "<leader>of", ":Telescope oldfiles<CR>", opts },
		{
			"<leader>fg",
			":lua require('telescope').extensions.live_grep_args.live_grep_args(require('telescope.themes').get_dropdown({}))<CR>",
			opts,
		},
		{ "<leader>fb", ":Telescope buffers<CR>", opts },
		{ "<leader>fh", ":Telescope help_tags<CR>", opts },
		{ "<leader>ft", ":Telescope treesitter<CR>", opts },
		{ "<leader>fc", ":Telescope commands<CR>", opts },
		{ "<leader>fr", ":Telescope resume<CR>", opts },
		{
			"<leader>cs",
			[[:lua require("telescope.builtin").spell_suggest(require("telescope.themes").get_cursor({}))<CR>]],
			opts,
		},
		{ "<leader>fy", ":Telescope yank_history<CR>", opts },
	},
}
