return {
	{
		-- allow few terminals around one vim session
		"akinsho/toggleterm.nvim",
	},
	{
		"sindrets/diffview.nvim",
	},
	{
		"APZelos/blamer.nvim",
	},
	{
		"kkharji/sqlite.lua",
	},
	{ "folke/which-key.nvim" },
	{ "folke/neoconf.nvim", cmd = "Neoconf" },
	{ "folke/neodev.nvim" },
	{ "nvim-tree/nvim-web-devicons" },
	{ "kyazdani42/nvim-tree.lua" },
	{ "nvim-lua/plenary.nvim" },
	{ "akinsho/bufferline.nvim" },
	{ "MattesGroeger/vim-bookmarks" },
	{
		-- f F navigation maps
		"unblevable/quick-scope",
	},
	{ "nvim-telescope/telescope.nvim" },
	{
		"nvim-telescope/telescope-fzf-native.nvim",
		run = "make",
	},
	{ "nvim-telescope/telescope-live-grep-args.nvim" },
	{
		"knubie/vim-kitty-navigator",
		run = "cp ./*.py ~/.config/kitty/",
	},
}
