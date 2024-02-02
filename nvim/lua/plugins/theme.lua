-- Change highlight group of active/inactive windows
function HandleWinEnter()
	vim.cmd([[
        hi ActiveWindow guibg=#17252c
        hi InactiveWindow guibg=#0D1B22
        setlocal winhighlight=Normal:ActiveWindow,NormalNC:InactiveWindow
    ]])
end

return {
	"Mofiqul/vscode.nvim",
	-- init = function()

	-- end,
	config = function()
		local c = require("vscode.colors").get_colors()

		require("vscode").setup({
			transparent = true,
			disable_nvimtree_bg = true,
			group_overrides = {
				-- this supports the same val table as vim.api.nvim_set_hl
				-- use colors from this colorscheme by requiring vscode.colors!
				Comment = { fg = c.vscGray, bg = c.None, bold = false },
			},
		})
		vim.cmd([[ colorscheme vscode]])

		local autocmd = vim.api.nvim_create_autocmd
		local group = vim.api.nvim_create_augroup("window_managment", {})
		autocmd("WinEnter", {
			pattern = "*",
			group = group,
			callback = HandleWinEnter,
		})
	end,
}
