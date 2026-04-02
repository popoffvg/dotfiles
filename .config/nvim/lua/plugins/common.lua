return {
	{
		"kkharji/sqlite.lua",
	},
	{ "folke/neoconf.nvim", cmd = "Neoconf" },
	{ "folke/neodev.nvim" },
	{ "nvim-lua/plenary.nvim" },
	{
		"letieu/wezterm-move.nvim",
		keys = { -- Lazy loading, don't need call setup() function
			{
				"<C-h>",
				function()
					require("wezterm-move").move("h")
				end,
			},
			{
				"<C-j>",
				function()
					require("wezterm-move").move("j")
				end,
			},
			{
				"<C-k>",
				function()
					require("wezterm-move").move("k")
				end,
			},
			{
				"<C-l>",
				function()
					require("wezterm-move").move("l")
				end,
			},
		},
	},
	{
		"karb94/neoscroll.nvim",
		lazy = false,
		init = function()
			require("neoscroll").setup()
		end,
	},
	-- { "tpope/vim-abolish" },
	{
		"numToStr/Comment.nvim",
		dependencies = {
			"folke/todo-comments.nvim",
		},
		config = function()
			require("todo-comments").setup({})
			require("Comment").setup()
		end,
	},
	{
		-- string split
		"AckslD/nvim-trevJ.lua",
		config = function()
			require("trevj").setup()
		end,
		keys = {
			{
				"<Leader>j",
				function()
					require("trevj").format_at_cursor()
				end,

				silent = true,
			},
		},
	},
	-- {
	-- 	"nvim-pack/nvim-spectre",
	-- 	dependencies = {
	-- 		"nvim-lua/plenary.nvim",
	-- 	},
	-- 	keys = {
	-- 		{ "<leader>fs", '<cmd>lua require("spectre").toggle()<CR>' },
	-- },
	-- },
	-- {
	-- 	-- for code action highligt
	-- 	"kosayoda/nvim-lightbulb",
	-- 	event = { "BufReadPre", "BufNewFile" },
	-- 	config = function()
	-- 		require("nvim-lightbulb").setup({
	-- 			autocmd = { enabled = true },
	-- 		})
	-- 	end,
	-- },
	{ "stevearc/dressing.nvim", event = { "BufReadPre", "BufNewFile" } },
	-- {
	-- 	"windwp/nvim-autopairs",
	-- 	event = "InsertEnter",
	-- 	config = true,
	-- 	-- use opts = {} for passing setup options
	-- 	-- this is equalent to setup({}) function
	-- },
	{
		"Wansmer/sibling-swap.nvim",
		requires = { "nvim-treesitter" },
		event = "BufReadPre",
		config = function()
			require("sibling-swap").setup({})
			vim.keymap.set(
				{ "v", "n" },
				"<leader>cl",
				"<cmd>lua require('sibling-swap').swap_with_right()<CR>",
				{ noremap = true, silent = true, desc = "a[c]tion: swap with right" }
			)
			vim.keymap.set(
				{ "v", "n" },
				"<leader>ch",
				"<cmd>lua require('sibling-swap').swap_with_left()<CR>",
				{ noremap = true, silent = true, desc = "a[c]tion: swap with left" }
			)
		end,
	},
	-- lazy.nvim
	{
		"chrisgrieser/nvim-various-textobjs",
		lazy = false,
		opts = {
			keymaps = {
				useDefaults = true,
			},
		},
	},
	-- 	{
	-- 		"max397574/better-escape.nvim",
	-- 		config = function()
	-- 			require("better_escape").setup()
	-- 		end,
	-- 	},
	{
		"mrjones2014/legendary.nvim",
		-- since legendary.nvim handles all your keymaps/commands,
		-- its recommended to load legendary.nvim before other plugins
		priority = 10000,
		lazy = false,
		init = function()
			require("legendary").setup({
				extensions = {
					nvim_tree = true,
					lazy_nvim = true,
					diffview = true,
					which_key = {
						auto_register = true,
					},
				},
			})
		end,
		keys = {
			{ "<leader>fc", "<cmd>:Legendary<CR>", desc = "Toggle Legendary" },
		},
	},
	{
		-- better quickfix
		"kevinhwang91/nvim-bqf",
		dependencies = {
			"junegunn/fzf",
		},
	},
	{
		"HakonHarnes/img-clip.nvim",
		event = "VeryLazy",
		opts = {
			-- add options here
			-- or leave it empty to use the default settings
		},
		keys = {
			-- suggested keymap
			{ "<leader>p", "<cmd>PasteImage<cr>", desc = "Paste image from system clipboard" },
		},
	},
	{
		"folke/snacks.nvim",
		priority = 1000,
		dependencies = { "saghen/blink.cmp" },
		lazy = false,
		opts = {
			bigfile = { enabled = true },
			notifier = { enabled = true },
			statuscolumn = { enabled = true },
			words = { enabled = true },
			scratch = { enabled = true },
			picker = {
				enabled = true,
				sources = {
					files = { hidden = true },
					grep = {
						hidden = true,
						layout = { preset = "vertical" },
					},
					lsp_references = {
						layout = { preset = "vertical" },
					},
				},
			},
			util = { enabled = true },
			dashboard = { enabled = true },
		},
		keys = {
			{
				"<leader>gh",
				function()
					require("snacks").git.blame_line()
				end,
				desc = "Show git line [H]istory",
			},
			{
				"<leader>dn",
				function()
					require("snacks").notifier.hide()
				end,
				desc = "Dismiss All Notifications",
			},
			{
				"gr",
				function()
					Snacks.picker.lsp_references()
				end,
				nowait = true,
				desc = "References",
			},
			{
				"<leader>/",
				function()
					Snacks.picker.grep()
				end,
				desc = "Grep",
			},
			{
				"<leader>ff",
				function()
					Snacks.picker.smart()
				end,
				desc = "Smart Find Files",
			},
			-- Top Pickers & Explorer
			{
				"<leader>,",
				function()
					Snacks.picker.buffers()
				end,
				desc = "Buffers",
			},
			{
				"<leader>fg",
				function()
					Snacks.picker.grep()
				end,
				desc = "Grep",
			},
			{
				"<leader>:",
				function()
					Snacks.picker.command_history()
				end,
				desc = "Command History",
			},
			{
				"<leader>n",
				function()
					Snacks.picker.notifications()
				end,
				desc = "Notification History",
			},
			{
				"<leader>e",
				function()
					Snacks.explorer()
				end,
				desc = "File Explorer",
			},
			-- find
			{
				"<leader>fb",
				function()
					Snacks.picker.buffers()
				end,
				desc = "Buffers",
			},
			{
				"<leader>gf",
				function()
					Snacks.picker.git_files()
				end,
				desc = "Find Git Files",
			},
			{
				"<leader>fp",
				function()
					Snacks.picker.projects()
				end,
				desc = "Projects",
			},
			{
				"<leader>fr",
				function()
					Snacks.picker.resume()
				end,
				desc = "Recent",
			},
			-- git
			{
				"<leader>gl",
				function()
					Snacks.picker.git_log()
				end,
				desc = "Git Log",
			},
			{
				"<leader>gL",
				function()
					Snacks.picker.git_log_line()
				end,
				desc = "Git Log Line",
			},
			{
				"<leader>gs",
				function()
					Snacks.picker.git_status()
				end,
				desc = "Git Status",
			},
			{
				"<leader>gS",
				function()
					Snacks.picker.git_stash()
				end,
				desc = "Git Stash",
			},
			{
				"<leader>gd",
				function()
					Snacks.picker.git_diff()
				end,
				desc = "Git Diff (Hunks)",
			},
			-- Grep
			-- search
			{
				'<leader>f"',
				function()
					Snacks.picker.registers()
				end,
				desc = "Registers",
			},
			{
				"<leader>f/",
				function()
					Snacks.picker.search_history()
				end,
				desc = "Search History",
			},
			{
				"<leader>fC",
				function()
					Snacks.picker.command_history()
				end,
				desc = "Command History",
			},
			{
				"<leader>fc",
				function()
					Snacks.picker.commands()
				end,
				desc = "Commands",
			},
			{
				"<leader>fdw",
				function()
					Snacks.picker.diagnostics()
				end,
				desc = "Diagnostics",
			},
			{
				"<leader>fdd",
				function()
					Snacks.picker.diagnostics_buffer()
				end,
				desc = "Buffer Diagnostics",
			},
			{
				"<leader>fh",
				function()
					Snacks.picker.help()
				end,
				desc = "Help Pages",
			},
			{
				"<leader>fH",
				function()
					Snacks.picker.highlights()
				end,
				desc = "Highlights",
			},
			{
				"<leader>fj",
				function()
					Snacks.picker.jumps()
				end,
				desc = "Jumps",
			},
			{
				"<leader>fl",
				function()
					Snacks.picker.loclist()
				end,
				desc = "Location List",
			},
			{
				"<leader>fm",
				function()
					Snacks.picker.marks()
				end,
				desc = "Marks",
			},
			{
				"<leader>fq",
				function()
					Snacks.picker.qflist()
				end,
				desc = "Quickfix List",
			},
			{
				"<leader>fu",
				function()
					Snacks.picker.undo()
				end,
				desc = "Undo History",
			},
			-- LSP
			{
				"gd",
				function()
					Snacks.picker.lsp_definitions()
				end,
				desc = "Goto Definition",
			},
			{
				"gD",
				function()
					Snacks.picker.lsp_declarations()
				end,
				desc = "Goto Declaration",
			},
			{
				"gr",
				function()
					Snacks.picker.lsp_references()
				end,
				nowait = true,
				desc = "References",
			},
			{
				"gi",
				function()
					Snacks.picker.lsp_implementations()
				end,
				desc = "Goto Implementation",
			},
			{
				"gt",
				function()
					Snacks.picker.lsp_type_definitions()
				end,
				desc = "Goto T[y]pe Definition",
			},
			{
				"<leader>ft",
				function()
					Snacks.picker.lsp_symbols()
				end,
				desc = "LSP Symbols",
			},
			{
				"<leader>fT",
				function()
					Snacks.picker.lsp_workspace_symbols()
				end,
				desc = "LSP Workspace Symbols",
			},
		},
	},
	{
		"MagicDuck/grug-far.nvim",
		config = function()
			require("grug-far").setup({
				-- options, see Configuration section below
				-- there are no required options atm
				-- engine = 'ripgrep' is default, but 'astgrep' can be specified
			})
		end,
	},
	{
		"AgusDOLARD/backout.nvim",
		opts = {
			chars = "(){}[]<>",
		},
		keys = {
			{ "g[", "<cmd>lua require('backout').back()<CR>", mode = { "n", "c" }, desc = "Prev bracket" },
			{ "g]", "<cmd>lua require('backout').out()<CR>", mode = { "n", "c" }, desc = "Next bracket" },
		},
	},
	{
		"gbprod/yanky.nvim",
		dependencies = { "folke/snacks.nvim" },
		event = { "BufReadPre", "BufNewFile" },
		config = function()
			require("yanky").setup({
				highlight = {
					on_put = false,
					on_yank = true,
					timer = 500,
				},
			})
		end,
		keys = {
			{ "p", "<Plug>(YankyPutAfter)", mode = { "n", "x" } },
			{ "P", "<Plug>(YankyPutBefore)", mode = { "n", "x" } },
			{ "gp", "<Plug>(YankyGPutAfter)", mode = { "n", "x" } },
			{ "gP", "<Plug>(YankyGPutBefore)", mode = { "n", "x" } },
			{ "[p", "<Plug>(YankyPreviousEntry)", noremap = true, mode = { "n" } },
			{ "]p", "<Plug>(YankyNextEntry)", noremap = true, mode = { "n" } },
			{ "<leader>fy", "<cmd>Telescope yank_history<CR>", noremap = true, mode = { "n" } },
		},
	},
	{ "craigemery/vim-autotag" },
}
