if vim.loader then
	vim.loader.enable()
end

_G.dd = function(...)
	require("util.debug").dump(...)
end
vim.print = _G.dd

require("configs.core")
require("configs.keymaps")
require("configs.lazy")
require("configs.helpers")
require("configs.leetcode")
