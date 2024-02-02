local keymap = vim.keymap.set
local saga = require("lspsaga")

saga.setup({
	ui = {
		border = "rounded",
	},
	outline = {
		win_position = "left",
	},
	code_action_prompt = { enable = false },
	lightbulb = {
		sign = false,
	},
})

-- saga.init_lsp_saga()

-- Lsp finder find the symbol definition implement reference
-- if there is no implement it will hide
-- when you use action in finder like open vsplit then you can
-- use <C-t> to jump back
keymap("n", "<Leader>h", "<cmd>Lspsaga finder<CR>", { silent = true })

-- Code action
keymap({ "n", "v" }, "<leader>ca", "<cmd>Lspsaga code_action<CR>", { silent = true })

-- Rename
keymap("n", "gr", "<cmd>Lspsaga rename<CR>", { silent = true })

-- Peek Definition
-- you can edit the definition file in this flaotwindow
-- also support open/vsplit/etc operation check definition_action_keys
-- support tagstack C-t jump back
-- keymap("n", "gD", "<cmd>Lspsaga peek_definition<CR>", { silent = true })

-- Show line diagnostics
keymap("n", "<leader>cd", "<cmd>Lspsaga show_line_diagnostics<CR>", { silent = true })

-- Show cursor diagnostic
keymap("n", "<leader>cd", "<cmd>Lspsaga show_cursor_diagnostics<CR>", { silent = true })

-- Diagnsotic jump can use `<c-o>` to jump back
keymap("n", "[e", "<cmd>Lspsaga diagnostic_jump_prev<CR>", { silent = true })
keymap("n", "]e", "<cmd>Lspsaga diagnostic_jump_next<CR>", { silent = true })

-- Only jump to error
keymap("n", "[E", function()
	require("lspsaga.diagnostic").goto_prev({ severity = vim.diagnostic.severity.ERROR })
end, { silent = true })
keymap("n", "]E", function()
	require("lspsaga.diagnostic").goto_next({ severity = vim.diagnostic.severity.ERROR })
end, { silent = true })

-- Outline
keymap("n", "<leader>o", "<cmd>Lspsaga outline<CR><CR>", { silent = true })

-- Hover Doc
keymap("n", "K", "<cmd>Lspsaga hover_doc<CR>", { silent = true })

vim.cmd([[
    highlight default LspFloatWinBorder guifg=black guibg=NONE

    augroup lspsaga
    autocmd!
    autocmd WinEnter * if &filetype == 'lspsagaoutline' && winnr('$') == 1 | bdel | endif
    augroup END
]])
-- autocmd BufNewFile,BufReadPost,FileReadPost  <buffer> silent!  *.go Lspsaga outline
