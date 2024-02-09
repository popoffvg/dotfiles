local HEIGHT_RATIO = 0.8
local WIDTH_RATIO = 0.5

return {
	"kyazdani42/nvim-tree.lua",
	dependencies = {
		"kyazdani42/nvim-web-devicons",
	},
	config = function()
		require("nvim-tree").setup({
			disable_netrw = true,
			respect_buf_cwd = false,
			diagnostics = {
				enable = true,
			},
			view = {
				float = {
					enable = true,
					quit_on_focus_loss = false,
					open_win_config = function()
						local screen_w = vim.opt.columns:get()
						local screen_h = vim.opt.lines:get() - vim.opt.cmdheight:get()
						local window_w = screen_w * WIDTH_RATIO
						local window_h = screen_h * HEIGHT_RATIO
						local window_w_int = math.floor(window_w)
						local window_h_int = math.floor(window_h)
						local center_x = (screen_w - window_w) / 2
						local center_y = ((vim.opt.lines:get() - window_h) / 2) - vim.opt.cmdheight:get()
						return {
							border = "rounded",
							relative = "editor",
							row = center_y,
							col = center_x,
							width = window_w_int,
							height = window_h_int,
						}
					end,
				},

				width = function()
					return math.floor(vim.opt.columns:get() * WIDTH_RATIO)
				end,
			},
			actions = {
				open_file = {
					quit_on_open = true,
				},
			},
		})

		local modifiedBufs = function(bufs)
			local t = 0
			for k, v in pairs(bufs) do
				if v.name:match("NvimTree_") == nil then
					t = t + 1
				end
			end
			return t
		end

		vim.api.nvim_create_autocmd("BufEnter", {
			nested = true,
			callback = function()
				if
					#vim.api.nvim_list_wins() == 1
					and vim.api.nvim_buf_get_name(0):match("NvimTree_") ~= nil
					and modifiedBufs(vim.fn.getbufinfo({ bufmodified = 1 })) == 0
				then
					vim.cmd("quit")
				end
			end,
		})
	end,
	keys = {
		{
			"<leader>t",
			function()
				local tree = require("nvim-tree.api").tree
				tree.toggle({ find_file = true })
			end,
			mode = { "n" },
			noremap = true,
			silent = true,
		},
	},
}
