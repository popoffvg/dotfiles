-- Change highlight group of active/inactive windows
function HandleWinEnter()
	vim.cmd([[
        hi ActiveWindow guibg=#17252c
        hi InactiveWindow guibg=#0D1B22
        hi WinSeparator guifg=VertSplit

        setlocal winhighlight=Normal:ActiveWindow,NormalNC:InactiveWindow
    ]])
end

return {
	{
		"rasulomaroff/reactive.nvim",
		event = "VeryLazy",
		config = function()
			require("reactive").setup({
				load = { "catppuccin-mocha-cursor", "catppuccin-mocha-cursorline" },
				builtin = {
					cursorline = true,
					cursor = true,
					modemsg = true,
				},
			})
		end,
	},
	{
		"catppuccin/nvim",
		name = "catppuccin",
		priority = 1000,
		config = function()
			require("catppuccin").setup({
				integrations = {
					cmp = true,
					gitsigns = true,
					nvimtree = true,
					treesitter = true,
					notify = true,
					lsp_trouble = true,
					mini = {
						enabled = true,
						indentscope_color = "",
					},
				},
			})
			vim.cmd([[ 
                colorscheme catppuccin
                hi WinSeparator guifg=VertSplit
            ]])

			-- local autocmd = vim.api.nvim_create_autocmd
			-- local group = vim.api.nvim_create_augroup("window_managment", {})
			-- autocmd("WinEnter", {
			-- 	pattern = "*",
			-- 	group = group,
			-- 	callback = HandleWinEnter,
			-- })
		end,
	},
}
