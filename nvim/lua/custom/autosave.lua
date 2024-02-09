local opts = { noremap = true, silent = true }
local keymap = vim.api.nvim_set_keymap

keymap("n", "<leader>w", ":w!<CR>", opts)
keymap("n", "<leader>W", ":wall!<CR>", opts)
