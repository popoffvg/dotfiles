return {
	{
		-- f F navigation maps
		"jinh0/eyeliner.nvim",
		lazt = false,

		config = function()
			require("eyeliner").setup({
				highlight_on_key = true, -- this must be set to true for dimming to work!
				-- [[ dim = true,
			})
			vim.cmd([[
            let g:qs_highlight_on_keys = ['f', 'F', 't', 'T']
highlight EyelinerPrimary guifg='#fc2642' gui=underline ctermfg=155 cterm=underline
highlight EyelinerSecondary guifg='#26fcf5' gui=underline ctermfg=81 cterm=underline
            ]])
		end,
	},
	{
		"folke/flash.nvim",
		event = "VeryLazy",
		dependencies = {
			"SmiteshP/nvim-navic",
			"MunifTanjim/nui.nvim",
		},
		opts = {
			modes = {
				char = {
					enabled = false,
				},
			},
		},
		keys = {
			{
				"<c-m>",
				function()
					require("flash").jump()
				end,
				mode = { "n" },
			},
			{
				"<c-n>",
				function()
					require("flash").treesitter_search()
				end,
				mode = { "n" },
			},
		},
	},
	{
		"stevearc/aerial.nvim",
		opts = {},
		-- Optional dependencies
		dependencies = {
			"nvim-treesitter/nvim-treesitter",
			"nvim-tree/nvim-web-devicons",
		},

		config = function()
			require("aerial").setup()
			vim.keymap.set("n", "<leader>ao", "<cmd>AerialToggle!<CR>")
		end,
	},
}
