local opts = { noremap = true, silent = true }

local builtin = require("telescope.builtin")

local relative_with = function(_, cols, _)
	if cols > 200 then
		return 170
	else
		return math.floor(cols * 0.87)
	end
end
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
			"neovim/nvim-lspconfig",
			{
				"radyz/telescope-gitsigns",
				dependencies = {
					"lewis6991/gitsigns.nvim",
					"nvim-telescope/telescope.nvim",
				},
				keys = {
					{ "<leader>fl", ":Telescope git_signs<CR>", opts },
				},
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
					layout_strategy = "vertical",
					file_ignore_patterns = { "node%_modules", "%.git", "%.venv", "venv" },
					layout_config = {
						horizontal = {
							-- preview_cutoff = 120,
							preview_width = 0.6,
						},
						vertical = {
							-- preview_cutoff = 40,
						},
						flex = {
							-- flip_columns = 150,
						},
						width = relative_with,

						height = function(_, _, max_lines)
							return math.min(max_lines, 80)
						end,
					},
					theme = "ivy",
					preview = false,
					-- preview = function()
					-- 	local window_size = vim.api.nvim_win_get_width(0)
					-- 	return window_size > 100
					-- end,
					wrap_results = true,
					mappings = {
						i = {
							["<C-h>"] = "which_key",
						},
					},
				},

				extensions = {
					fzf = {},
					["ui-select"] = {
						require("telescope.themes").get_ivy({}),
					},
					frecency = {
						workspace_scan_cmd = { "fd", "-Htf" },
						theme = "ivy",
						default_workspace = "CWD",
						preview = false,
						show_filter_column = false,
						db_validate_threshold = 1,
						path_display = path_display,
						hide_current_buffer = false,
						hidden = true,
						db_safe_mode = false,
						mappings = {
							i = {
								["<C-v>"] = "select_vertical",
							},
						},
					},
					egrepify = {
						vimgrep_arguments = {
							"rg",
							"--color=never",
							"--no-heading",
							"--with-filename",
							"--line-number",
							"--column",
							"--smart-case",
							"--hidden",
							"--trim", -- add this value
						},
						wrap_results = false,
						theme = "ivy",
						preview = true,
						mappings = {
							i = {
								["<C-v>"] = "select_vertical",
							},
						},
					},
					ast_grep = {
						preview = true,
						theme = "ivy",
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
						theme = "ivy",
						preview = true,
						show_line = false,
						path_display = path_display,
					},
					lsp_implementations = {
						theme = "ivy",
						show_line = true,
						path_display = path_display,
						preview = true,
					},
					find_files = {
						theme = "ivy",
						preview = false,
						hidden = true,
						mappings = {
							i = {
								["<C-v>"] = "select_vertical",
							},
						},
						find_command = {
							"rg",
							"--files",
							"--color=never",
							"--no-heading",
							"--line-number",
							"--column",
							"--smart-case",
							"--hidden",
							"--glob",
							"!{.git/*,.svelte-kit/*,target/*,node_modules/*, .venv/*, venv/*, *.canvas}",
							"--path-separator",
							"/",
						},
					},
					live_grep = {
						mappings = {
							i = { ["<c-f>"] = actions.to_fuzzy_refine },
						},
					},
					lsp_document_symbols = {
						theme = "ivy",
						preview = true,
						symbol_width = relative_with,
					},
					lsp_outgoing_calls = {
						theme = "ivy",
						preview = true,
					},
					current_buffer_fuzzy_find = {
						theme = "ivy",
						preview = true,
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
			require("telescope").load_extension("yank_history")
			require("telescope").load_extension("frecency")
			require("telescope").load_extension("egrepify")
			require("telescope").load_extension("notify")

			require("yanky.telescope.mapping").put("p")
			require("yanky.telescope.mapping").put("P")
			require("yanky.telescope.mapping").put("gp")
			require("yanky.telescope.mapping").put("gP")
			require("telescope").load_extension("git_signs")
		end,
		keys = {
			{ "<leader>ff", ":Telescope find_files hidden=true preview=false<CR>", opts },
			{ "<leader>fn", ":Telescope notify<CR>", opts },
			{ "<leader>fg", ":Telescope egrepify<CR>", opts },
			{ "<leader>fb", ":Telescope buffers<CR>", opts },
			{ "<leader>fo", ":Telescope lsp_outgoing_calls<CR>", opts },
			{ "<leader>fw", ":Telescope current_buffer_fuzzy_find fuzzy=true case_mode=ignore_case<CR>", opts },
			-- use "legendary" instead
			-- { "<leader>fc", ":Telescope commands<CR>", opts },
			{ "<leader>fr", ":Telescope resume<CR>", opts },
			{ "<leader>fa", ":Telescope ast_grep<CR>", opts },
			{ "<leader>fm", ":Telescope marks<CR>", opts },
			{ "<leader>fG", ":Telescope git_status<CR>", opts },
			{ "<leader>fj", ":Telescope jumplist<CR>", opts },
			{ "<leader>fp", ":Telescope yank_history<CR>", opts },
			{ "gr", "<cmd>Telescope lsp_references<CR>", {} },
			{ "gd", "<cmd>Telescope lsp_definitions<CR>", opts },
			{
				"gi",
				"<cmd>Telescope lsp_implementations<CR>",
				opts,
			},
			{ "<leader>ft", builtin.lsp_document_symbols, mode = { "n" }, desc = "Open symbol picker" },
			{
				"<leader>fT",
				builtin.lsp_dynamic_workspace_symbols,
				desc = "Open symbol picker (workspace)",
			},
			{ "<leader>fu", builtin.lsp_references, desc = "Open references picker", mode = { "n" } },
		},
	},
}
