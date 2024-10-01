if vim.loader then
	vim.loader.enable()
end

-- vim.guifont = "Fira Mono Nerd Font:h14"

require("configs.core")
require("configs.keymaps")
require("configs.lazy")
require("configs.helpers")
require("configs.leetcode")
require("configs.templates")
