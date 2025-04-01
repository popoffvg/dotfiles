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
	{
		"gbprod/yanky.nvim",
		dependencies = {
			"kkharji/sqlite.lua",
		},
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
		lazy = false,
		opts = {
			bigfile = { enabled = true },
			notifier = { enabled = true },
			statuscolumn = { enabled = true },
			words = { enabled = true },
			scratch = { enabled = true },
			dashboard = { enabled = true },
		},
		keys = {
			{
				"<leader>fh",
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
			-- {
			-- 	"<leader>.",
			-- 	function()
			-- 		Snacks.scratch()
			-- 	end,
			-- 	desc = "Toggle Scratch Buffer",
			-- },
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
			{ "((", "<cmd>lua require('backout').back()<CR>", mode = { "n", "c" }, desc = "Prev bracket" },
			{ "))", "<cmd>lua require('backout').out()<CR>", mode = { "n", "c" }, desc = "Next bracket" },
		},
	},
}
