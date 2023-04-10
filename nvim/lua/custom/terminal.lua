require("toggleterm").setup({
	direction = "float",
})

local opts = { noremap = true, silent = true }
local keymap = vim.api.nvim_set_keymap
keymap("n", "ttm", ":ToggleTerm<CR>", opts)
keymap("t", "<C-o>", [[<C-\><C-n>]], opts)