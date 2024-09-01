local HEIGHT_RATIO = 0.8
local WIDTH_RATIO = 0.5

return {
	-- "kyazdani42/nvim-tree.lua",
	-- dependencies = {
	-- 	"kyazdani42/nvim-web-devicons",
	-- },
	-- config = function()
	-- 	require("nvim-tree").setup({
	-- 		disable_netrw = true,
	-- 		respect_buf_cwd = false,
	-- 		diagnostics = {
	-- 			enable = true,
	-- 		},
	-- 		view = {
	-- 			float = {
	-- 				enable = true,
	-- 				quit_on_focus_loss = false,
	-- 				open_win_config = function()
	-- 					local screen_w = vim.opt.columns:get()
	-- 					local screen_h = vim.opt.lines:get() - vim.opt.cmdheight:get()
	-- 					local window_w = screen_w * WIDTH_RATIO
	-- 					local window_h = screen_h * HEIGHT_RATIO
	-- 					local window_w_int = math.floor(window_w)
	-- 					local window_h_int = math.floor(window_h)
	-- 					local center_x = (screen_w - window_w) / 2
	-- 					local center_y = ((vim.opt.lines:get() - window_h) / 2) - vim.opt.cmdheight:get()
	-- 					return {
	-- 						border = "rounded",
	-- 						relative = "editor",
	-- 						row = center_y,
	-- 						col = center_x,
	-- 						width = window_w_int,
	-- 						height = window_h_int,
	-- 					}
	-- 				end,
	-- 			},
	--
	-- 			width = function()
	-- 				return math.floor(vim.opt.columns:get() * WIDTH_RATIO)
	-- 			end,
	-- 		},
	-- 		actions = {
	-- 			open_file = {
	-- 				quit_on_open = true,
	-- 			},
	-- 		},
	-- 	})
	--
	-- 	local modifiedBufs = function(bufs)
	-- 		local t = 0
	-- 		for k, v in pairs(bufs) do
	-- 			if v.name:match("NvimTree_") == nil then
	-- 				t = t + 1
	-- 			end
	-- 		end
	-- 		return t
	-- 	end
	--
	-- 	vim.api.nvim_create_autocmd("BufEnter", {
	-- 		nested = true,
	-- 		callback = function()
	-- 			if
	-- 				#vim.api.nvim_list_wins() == 1
	-- 				and vim.api.nvim_buf_get_name(0):match("NvimTree_") ~= nil
	-- 				and modifiedBufs(vim.fn.getbufinfo({ bufmodified = 1 })) == 0
	-- 			then
	-- 				vim.cmd("quit")
	-- 			end
	-- 		end,
	-- 	})
	-- end,
	-- keys = {
	-- 	-- {
	-- 	-- 	"<leader>t",
	-- 	-- 	function()
	-- 	-- 		local tree = require("nvim-tree.api").tree
	-- 	-- 		tree.toggle({ find_file = true })
	-- 	-- 	end,
	-- 	-- 	mode = { "n" },
	-- 	-- 	noremap = true,
	-- 	-- 	silent = true,
	-- 	-- },
	-- },
	-- {
	-- 	"stevearc/oil.nvim",
	-- 	opts = {},
	-- 	-- Optional dependencies
	-- 	dependencies = { "nvim-tree/nvim-web-devicons" },
	-- 	config = function()
	-- 		require("oil").setup()
	-- 	end,
	-- 	keys = {
	-- 		{ "<a-t>", "<cmd>:Oil<CR>" },
	-- 	},
	-- },
	{
		"echasnovski/mini.files",
		version = "*",
		config = function()
			require("mini.files").setup({
				permanent_delete = false,
			})
		end,
		keys = {
			{
				"<leader>d", -- mnemonic [d]irectory
				function()
					require("mini.files").open(vim.api.nvim_buf_get_name(0), false)
				end,
			},
		},
	},

	-- {
	-- 	"prichrd/netrw.nvim",
	-- 	config = function()
	-- 		vim.g.netrw_liststyle = 3
	-- 		require("netrw").setup({
	-- 			-- Put your configuration here, or leave the object empty to take the default
	-- 			-- configuration.
	-- 			-- icons = {
	-- 			-- 	symlink = "", -- Symlink icon (directory and file)
	-- 			-- 	directory = "", -- Directory icon
	-- 			-- 	file = "", -- File icon
	-- 			-- },
	-- 			use_devicons = true, -- Uses nvim-web-devicons if true, otherwise use the file icon specified above
	-- 			mappings = {
	-- 				["q"] = ":bd!<CR>",
	-- 			},
	-- 		})
	-- 	end,
	-- 	keys = {
	-- 		{ "<leader>t", ":e .<CR>" },
	-- 	},
	-- },
	{
		"nvim-neo-tree/neo-tree.nvim",
		branch = "v3.x",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-tree/nvim-web-devicons", -- not strictly required, but recommended
			"MunifTanjim/nui.nvim",
			-- "3rd/image.nvim", -- Optional image support in preview window: See `# Preview Mode` for more information
		},
		config = function()
			require("neo-tree").setup({
				enable_git_status = true,
				enable_diagnostics = true,
				opts = {
					auto_restore_session_experimental = true,
				},
				window = {
					mappings = {
						["<space>"] = { "toggle_node", nowait = true },
						-- 	["<cr>"] = "open_tabnew",
						-- 	["S"] = "open_split",
						-- 	["s"] = "open_vsplit",
					},
				},
				event_handlers = {

					{
						event = "file_open_requested",
						handler = function()
							-- auto close
							-- vimc.cmd("Neotree close")
							-- OR
							require("neo-tree.command").execute({ action = "close" })
						end,
					},
				},
			})
		end,

		keys = {
			{
				"<leader>t",
				function()
					local filetype = vim.bo.filetype

					if filetype == "alfa" then
						require("neo-tree.command").execute({
							action = "focus",
							position = "top",
						})
						return
					end

					require("neo-tree.command").execute({
						action = "focus",
						reveal_file = vim.fn.expand("%:p"),
						position = "top",
					})
				end,
			},
		},
	},
}
