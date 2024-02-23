return {
	"nvim-lualine/lualine.nvim",
	lazy = false,
	dependencies = {
		"SmiteshP/nvim-navic",
		"Mofiqul/vscode.nvim",
		"nvim-tree/nvim-web-devicons",
	},
	config = function()
		local navic = require("nvim-navic")
		local c = require("vscode.colors").get_colors()

		require("lualine").setup({
			options = {
				componlnt_separators = "|",
				section_separators = { left = "", right = "" },
				globalstatus = true,
				theme = "catppuccin",
			},
			tabline = {
				lualine_a = {
					-- {
					-- 	"filename",
					-- 	path = 1,
					-- 	-- mode = 2, -- index + name
					-- },
				},
				lualine_b = {
					{
						function()
							local size = 4
							local loc = navic.get_location()
							local parts = vim.split(loc, ">")

							if #parts <= size then
								return loc
							end

							local newloc = parts[1]
							for i = 2, size, 1 do
								newloc = newloc .. ">" .. parts[i]
							end

							return newloc
						end,
						-- https://github.com/nvim-lualine/lualine.nvim/wiki/Writing-a-theme
						-- for lualine_z theme will be as lualine_a with mode changing
						-- color = { bg = c.TabLine, fg = c.Normal, gui = "none" },
					},
				},
				lualine_y = {
					"diagnostics",
				},
				-- lualine_a = {
				-- 	{
				-- 		"buffers",
				-- 		hide_filename_extension = true,
				-- 		-- mode = 2, -- index + name
				-- 	},
				-- },
			},
			sections = {
				lualine_a = {
					{
						"mode",
						path = 1,
					},
				},
				lualine_b = { "branch" },
				lualine_c = {
					{
						"filename",
						path = 1,
						-- mode = 2, -- index + name
					},
				},
				lualine_x = {},
				lualine_y = { "filetype" },
				lualine_z = { "location" },
			},
		})
	end,
}
