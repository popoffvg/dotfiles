local autocmd = vim.api.nvim_create_autocmd  

vim.opt.list = true
vim.g.indent_blankline_use_treesitter = true

require("indent_blankline").setup {
    show_current_context = false,
    show_current_context_start = false,
}

autocmd("BufEnter", {
	group = indent_blankline,
	pattern = "*",
	callback = function()
        -- if  vim.bo.filetype == "go" then
        --     vim.g.indent_blankline_show_current_context = false
        --     return
        -- end

        -- vim.g.indent_blankline_show_current_context = true
	end,
})
