return {
	{
		-- allow few terminals around one vim session
		"akinsho/toggleterm.nvim",
		keys = {
			{ "ttm", ":ToggleTerm<Cr>" },
		},
	},
	{
		"kkharji/sqlite.lua",
	},
	{ "folke/neoconf.nvim", cmd = "Neoconf" },
	{ "folke/neodev.nvim" },
	{ "nvim-lua/plenary.nvim" },
	-- {
	-- 	"https://git.sr.ht/~swaits/zellij-nav.nvim",
	-- 	lazy = true,
	-- 	event = "VeryLazy",
	-- 	keys = {
	-- 		{
	-- 			"<c-h>",
	-- 			"<cmd>ZellijNavigateLeft<cr>",
	-- 			{ silent = true, desc = "navigate left" },
	-- 		},
	-- 		{
	-- 			"<c-j>",
	-- 			"<cmd>ZellijNavigateDown<cr>",
	-- 			{ silent = true, desc = "navigate down" },
	-- 		},
	-- 		{
	-- 			"<c-k>",
	-- 			"<cmd>ZellijNavigateUp<cr>",
	-- 			{ silent = true, desc = "navigate up" },
	-- 		},
	-- 		{
	-- 			"<c-l>",
	-- 			"<cmd>ZellijNavigateRight<cr>",
	-- 			{ silent = true, desc = "navigate right" },
	-- 		},
	-- 	},
	-- 	opts = {},
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
	-- {
	-- 	"alexghergh/nvim-tmux-navigation",
	-- 	opts = {
	-- 		disable_when_zoomed = true,
	-- 		keybindings = {
	-- 			left = "<C-h>",
	-- 			down = "<C-j>",
	-- 			up = "<C-k>",
	-- 			right = "<C-l>",
	-- 			last_active = "<C-\\>",
	-- 			next = "<C-Space>",
	-- 		},
	-- 	},
	-- 	lazy = false,
	-- },
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
	{ "tpope/vim-abolish" },
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
	-- 	"numToStr/FTerm.nvim",
	-- 	config = true,
	-- 	keys = {
	-- 		{
	-- 			"<leader>ft",
	-- 			function()
	-- 				require("FTerm").toggle()
	-- 			end,
	-- 			desc = "Toggle terminal",
	-- 			mode = { "n", "t" },
	-- 		},
	-- 	},
	-- },
	-- { "famiu/bufdelete.nvim" },
	-- {
	-- 	"tversteeg/registers.nvim",
	-- 	cmd = "Registers",
	-- 	config = true,
	-- 	keys = {
	-- 		{ '"', mode = { "n", "v" } },
	-- 		{ "<C-R>", mode = "i" },
	-- 	},
	-- 	name = "registers",
	-- },
	{
		"windwp/nvim-autopairs",
		event = "InsertEnter",
		config = true,
		-- use opts = {} for passing setup options
		-- this is equalent to setup({}) function
	},
	{
		"Wansmer/sibling-swap.nvim",
		requires = { "nvim-treesitter" },
		event = "BufReadPre",
		config = function()
			require("sibling-swap").setup({})
			vim.keymap.set(
				{ "v", "n" },
				"wl",
				"<cmd>lua require('sibling-swap').swap_with_right()<CR>",
				{ noremap = true, silent = true, desc = "s[w]ap with right" }
			)
			vim.keymap.set(
				{ "v", "n" },
				"wh",
				"<cmd>lua require('sibling-swap').swap_with_left()<CR>",
				{ noremap = true, silent = true, desc = "s[w]ap with left" }
			)
		end,
	},
	{
		"chrisgrieser/nvim-various-textobjs",
		lazy = true,
		opt = {},
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
					lazy_nvim = true,
					diffview = true,
					which_key = {
						auto_register = true,
					},
				},
			})
		end,
		-- sqlite is only needed if you want to use frecency sorting
		-- dependencies = { 'kkharji/sqlite.lua' }
	},
}
