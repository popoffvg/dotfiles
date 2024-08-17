if vim.loader then
	vim.loader.enable()
end

_G.dd = function(...)
	require("util.debug").dump(...)
end
vim.print = _G.dd
-- vim.guifont = "Fira Mono Nerd Font:h14"

require("configs.core")
require("configs.keymaps")
require("configs.lazy")
require("configs.helpers")
require("configs.leetcode")
