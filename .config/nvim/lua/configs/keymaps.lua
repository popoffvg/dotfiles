local opts = { noremap = true, silent = true }
local keymap = vim.api.nvim_set_keymap

keymap("n", "<leader>s", ":w!<CR>", opts)
keymap("n", "<leader>S", ":wall!<CR>", opts)
keymap("n", "D", ":lua vim.lsp.buf.hover()<CR>", opts)
keymap("v", "<C-r>", "hy:%s/<C-r>h//gc<left><left><left>", opts)
