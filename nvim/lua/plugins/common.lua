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
	-- { "akinsho/bufferline.nvim" },
	-- { "MattesGroeger/vim-bookmarks" },
	{
		"christoomey/vim-tmux-navigator",
		lazy = false,
		cmd = {
			"TmuxNavigateLeft",
			"TmuxNavigateDown",
			"TmuxNavigateUp",
			"TmuxNavigateRight",
			"TmuxNavigatePrevious",
		},
		config = function()
			vim.cmd([[
                " turn off tmux linebar in vim
                " autocmd VimEnter * nested silent !tmux set status off
                " autocmd VimLeave * silent !tmux set status on
                " autocmd FocusGained * silent !tmux set status off
            ]])
		end,
		keys = {
			{ "<c-h>", "<cmd><C-U>TmuxNavigateLeft<cr>" },
			{ "<c-j>", "<cmd><C-U>TmuxNavigateDown<cr>" },
			{ "<c-k>", "<cmd><C-U>TmuxNavigateUp<cr>" },
			{ "<c-l>", "<cmd><C-U>TmuxNavigateRight<cr>" },
			{ "<c-\\>", "<cmd><C-U>TmuxNavigatePrevious<cr>" },
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
			{ "fp", "<cmd>Telescope yank_history<CR>", noremap = true, mode = { "n" } },
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
	{
		-- for code action highligt
		"kosayoda/nvim-lightbulb",
		event = { "BufReadPre", "BufNewFile" },
		config = function()
			require("nvim-lightbulb").setup({
				autocmd = { enabled = true },
			})
		end,
	},
	{ "stevearc/dressing.nvim", event = { "BufReadPre", "BufNewFile" } },
	{
		"ThePrimeagen/harpoon",
		branch = "harpoon2",
		dependencies = { "nvim-lua/plenary.nvim" },
		config = function()
			local harpoon = require("harpoon")
			harpoon.setup({})
			local conf = require("telescope.config").values
			local toggle_telescope = function(harpoon_files)
				local file_paths = {}
				for _, item in ipairs(harpoon_files.items) do
					table.insert(file_paths, item.value)
				end

				require("telescope.pickers")
					.new({}, {
						prompt_title = "Harpoon",
						finder = require("telescope.finders").new_table({
							results = file_paths,
						}),
						previewer = conf.file_previewer({}),
						sorter = conf.generic_sorter({}),
					})
					:find()
			end
			vim.keymap.set("n", "<C-e>", function()
				toggle_telescope(harpoon:list())
			end, { desc = "Open harpoon window" })
		end,
		keys = {
			{
				"<leader>a",
				function()
					require("harpoon"):list():append()
				end,
				mode = "n",
			},
			{
				"<C-e>",
				function()
					require("harpoon.ui"):toggle_quick_menu(require("harpoon"):list())
				end,
				mode = "n",
			},
			{
				"<C-1>",
				function()
					require("harpoon"):list():select(1)
				end,
				mode = "n",
			},
			{
				"<C-2>",
				function()
					require("harpoon"):list():select(2)
				end,
				mode = "n",
			},
			{
				"<C-3>",
				function()
					require("harpoon"):list():select(3)
				end,
				mode = "n",
			},
			{
				"<C-4>",
				function()
					require("harpoon"):list():select(4)
				end,
				mode = "n",
			},
			{
				"<C-S-P>",
				function()
					require("harpoon"):list():prev()
				end,
				mode = "n",
			},
			{
				"<C-S-N>",
				function()
					require("harpoon"):list():next()
				end,
				mode = "n",
			},
		},
	},
	{
		"numToStr/FTerm.nvim",
		config = true,
		keys = {
			{
				"<leader>ft",
				function()
					require("FTerm").toggle()
				end,
				desc = "Toggle terminal",
				mode = { "n", "t" },
			},
		},
	},
	{ "famiu/bufdelete.nvim" },
	{
		"tversteeg/registers.nvim",
		cmd = "Registers",
		config = true,
		keys = {
			{ '"', mode = { "n", "v" } },
			{ "<C-R>", mode = "i" },
		},
		name = "registers",
	},
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
			vim.api.nvim_set_keymap(
				"n",
				"<S-l>",
				"<cmd>lua require('sibling-swap').swap_with_right()<CR>",
				{ noremap = true, silent = true }
			)
			vim.api.nvim_set_keymap(
				"n",
				"<S-h>",
				"<cmd>lua require('sibling-swap').swap_with_left()<CR>",
				{ noremap = true, silent = true }
			)
		end,
	},
}
