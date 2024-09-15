-- GO TEMPLATES
vim.api.nvim_create_autocmd("BufNewFile", {
	pattern = "*.go",
	callback = function()
		vim.cmd("0r ~/.config/nvim/templates/skeleton.go")
		vim.cmd("%s/%folder%/" .. vim.fn.expand("%:h:t") .. "/g")
		vim.cmd("set nomodified")
	end,
})

vim.api.nvim_create_autocmd("BufEnter", {
	pattern = "*.go",
	callback = function()
		if vim.fn.line("$") == 1 and vim.fn.getline(1) == "" then
			vim.cmd("0r ~/.config/nvim/templates/skeleton.go")
			vim.cmd("%s/%folder%/" .. vim.fn.expand("%:h:t") .. "/g")
			vim.cmd("set nomodified")
		end
	end,
})

-- MD TEMPLATES
vim.api.nvim_create_autocmd("BufNewFile", {
	pattern = "*/Z-Core/*.md",
	callback = function()
		vim.cmd("0r ~/.config/nvim/templates/note.md")
		vim.cmd("%s/%folder%/" .. vim.fn.expand("%:h:t") .. "/g")
		vim.cmd("set nomodified")
	end,
})

vim.api.nvim_create_autocmd("BufEnter", {
	pattern = "*/Z-Core/*.md",
	callback = function()
		if vim.fn.line("$") == 1 and vim.fn.getline(1) == "" then
			vim.cmd("0r ~/.config/nvim/templates/note.md")
			vim.cmd("%s/%folder%/" .. vim.fn.expand("%:h:t") .. "/g")
			vim.cmd("set nomodified")
		end
	end,
})
