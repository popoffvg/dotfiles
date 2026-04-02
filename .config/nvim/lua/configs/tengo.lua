-- create autocmd for tengo filetype
vim.api.nvim_create_autocmd("FileType", {
	pattern = "tengo",
	callback = function()
		vim.keymap.set("n", "gd", "<c-]>", { noremap = true, silent = true })
	end,
})

vim.api.nvim_create_autocmd("FileType", {
	pattern = "tengo",
	callback = function()
		vim.keymap.set("n", "gr", function()
			Snacks.picker.grep_word()
		end, { noremap = true, silent = true })
	end,
})
