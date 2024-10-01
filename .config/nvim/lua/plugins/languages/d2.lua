return {
	{
		"terrastruct/d2-vim",
		config = function()
			vim.api.nvim_create_autocmd("BufWritePost", {
				pattern = "*.d2",
				command = [[
                      silent !d2 fmt %
                ]],
			})
			vim.api.nvim_create_autocmd("BufWritePost", {
				pattern = "*.d2",
				command = [[
                      silent !d2 %:r.d2 %:r.svg
                ]],
			})
		end,
	},
}
