local opts = { noremap = true, silent = true }

return {
	{
		"nvim-telescope/telescope.nvim",
		dependencies = {
			"nvim-telescope/telescope-ui-select.nvim",
			"nvim-treesitter/nvim-treesitter",
			"nvim-telescope/telescope-live-grep-args.nvim",
			{ "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
			"junegunn/fzf.vim",
			"ThePrimeagen/git-worktree.nvim",
			"gbprod/yanky.nvim",
			"nvim-lua/plenary.nvim",
			"nvim-telescope/telescope-frecency.nvim",
			"nvim-lua/plenary.nvim",
			"fdschmidt93/telescope-egrepify.nvim",
			"Marskey/telescope-sg",
			{
				"nvim-telescope/telescope-file-browser.nvim",
				dependencies = { "nvim-telescope/telescope.nvim", "nvim-lua/plenary.nvim" },
			},
		},
		config = function()
			local Path = require("plenary.path")
			local path_display = function(opts, path)
				local fu = require("telescope.utils")
				local tail = fu.path_tail(path)
				local dir = vim.fs.dirname(path)
				local parent = Path:new(dir):make_relative(opts.cwd)
				return string.format("%s\t\t%s", tail, parent)
			end
			local actions = require("telescope.actions")
			local fb_actions = require("telescope._extensions.file_browser.actions")
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
					theme = "dropdown",
					preview = false,
					wrap_results = true,
				},

				extensions = {
					["ui-select"] = {
						require("telescope.themes").get_dropdown({}),
					},
					frecency = {
						workspace_scan_cmd = { "fd", "-Htf" },
						theme = "dropdown",
						default_workspace = "CWD",
						preview = false,
						show_filter_column = false,
						db_validate_threshold = 1,
						path_display = path_display,
						hide_current_buffer = false,
						hidden = true,
						db_safe_mode = false,
					},
					egrepify = {
						wrap_results = false,
						theme = "dropdown",
						preview = true,
					},
					ast_grep = {
						preview = true,
						theme = "dropdown",
						command = {
							"sg",
							"--json=stream",
						}, -- must have --json=stream
						grep_open_files = false, -- search in opened files
						lang = nil, -- string value, specify language for ast-grep `nil` for default
					},
					file_browser = {
						hidden = true,
						mappings = {
							["i"] = {
								-- ["<C-k>"] = fb_actions.open,
								["<C-H>"] = fb_actions.toggle_hidden,
								["<C-k>"] = fb_actions.goto_parent_dir,
								["<C-j>"] = actions.select_default,
							},
							["n"] = {
								-- ["<C-k>"] = fb_actions.open,
								["<C-H>"] = fb_actions.toggle_hidden,
								["<C-k>"] = fb_actions.goto_parent_dir,
								["<C-j>"] = actions.select_default,
							},
						},
					},
				},
				pickers = {
					lsp_references = {
						theme = "dropdown",
						show_line = false,
						preview = true,
						path_display = path_display,
					},
					lsp_implementations = {
						theme = "dropdown",
						show_line = false,
						path_display = path_display,
					},
					find_files = {
						theme = "dropdown",
						preview = false,
						hidden = true,
					},
					live_grep = {
						mappings = {
							i = { ["<c-f>"] = actions.to_fuzzy_refine },
						},
					},
				},
			})

			vim.api.nvim_create_autocmd("FileType", {
				pattern = "TelescopeResults",
				callback = function(ctx)
					vim.api.nvim_buf_call(ctx.buf, function()
						vim.fn.matchadd("TelescopeParent", "\t\t.*$")
						vim.api.nvim_set_hl(0, "TelescopeParent", { link = "Comment" })
					end)
				end,
			})

			require("telescope").load_extension("fzf")
			require("telescope").load_extension("git_worktree")
			require("telescope").load_extension("live_grep_args")
			require("telescope").load_extension("yank_history")
			require("telescope").load_extension("frecency")
			require("telescope").load_extension("egrepify")
			require("telescope").load_extension("ui-select")
			require("telescope").load_extension("file_browser")

			require("yanky.telescope.mapping").put("p")
			require("yanky.telescope.mapping").put("P")
			require("yanky.telescope.mapping").put("gp")
			require("yanky.telescope.mapping").put("gP")
			require("yanky.telescope.mapping").delete()
			-- require("yanky.telescope.mapping").set_register(regname) -- fill register {regname} with selected value
		end,
		keys = {
			-- { "<leader>ff", ":Telescope find_files hidden=true preview=false<CR>", opts },
			{ "<leader>ff", "<Cmd>Telescope frecency<CR>", opts },
			-- { "<leader>of", ":Telescope oldfiles<CR>", opts },
			-- {
			-- 	"<leader>fg",
			-- 	":lua require('telescope').extensions.live_grep_args.live_grep_args(require('telescope.themes').get_dropdown({}))<CR>",
			-- 	opts,
			-- },
			{ "<leader>fg", ":Telescope egrepify<CR>", opts },
			{ "<leader>fb", ":Telescope buffers<CR>", opts },
			{ "<leader>fh", ":Telescope help_tags<CR>", opts },
			{ "<leader>ft", ":Telescope lsp_document_symbols<CR>", opts },
			{ "<leader>fo", ":Telescope lsp_outgoing_calls<CR>", opts },
			{ "<leader>fc", ":Telescope commands<CR>", opts },
			{ "<leader>fr", ":Telescope resume<CR>", opts },
			{ "<leader>fa", ":Telescope ast_grep<CR>", opts },
			{
				"<leader>cs",
				[[:lua require("telescope.builtin").spell_suggest(require("telescope.themes").get_cursor({}))<CR>]],
				opts,
			},
			{ "<leader>fy", ":Telescope yank_history<CR>", opts },
			{ "gr", "<cmd>Telescope lsp_references<CR>", opts },
			{ "gd", "<cmd>Telescope lsp_definitions<CR>", opts },
			{
				"gi",
				"<cmd>Telescope lsp_implementations<CR>",
				opts,
			},

			-- ctrl + t - show hidden  file
			-- { "<space>t", ":Telescope file_browser path=%:p:h<CR>", opts },
			-- { "<space>t", ":Telescope file_browser path=%:p:h<CR>", opts },
		},
	},
	{
		"LukasPietzschmann/telescope-tabs",
		config = function()
			require("telescope").load_extension("telescope-tabs")
			require("telescope-tabs").setup({
				-- Your custom config :^)
			})
		end,
		dependencies = { "nvim-telescope/telescope.nvim" },
		keys = {
			{
				"<leader>fw",
				function()
					require("telescope-tabs").list_tabs()
				end,
			},
		},
	},
}
