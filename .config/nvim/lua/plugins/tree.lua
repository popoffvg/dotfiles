local HEIGHT_RATIO = 0.8
local WIDTH_RATIO = 0.5

return {
	-- {
	-- 	"echasnovski/mini.files",
	-- 	version = "*",
	-- 	config = function()
	-- 		require("mini.files").setup({
	-- 			permanent_delete = false,
	-- 		})
	-- 	end,
	-- 	keys = {
	-- 		{
	-- 			"<leader>d", -- mnemonic [d]irectory
	-- 			function()
	-- 				require("mini.files").open(vim.api.nvim_buf_get_name(0), false)
	-- 			end,
	-- 		},
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
		opts = function(_, opts)
			local function on_move(data)
				require("snacks").rename.on_rename_file(data.source, data.destination)
			end
			local events = require("neo-tree.events")
			opts.event_handlers = opts.event_handlers or {}
			vim.list_extend(opts.event_handlers, {
				{ event = events.FILE_MOVED, handler = on_move },
				{ event = events.FILE_RENAMED, handler = on_move },
			})
		end,
		config = function()
			require("neo-tree").setup({
				enable_git_status = true,
				enable_diagnostics = true,
				filesystem = {
					filtered_items = {
						visible = true, -- This is what you want: If you set this to `true`, all "hide" just mean "dimmed out"
						hide_dotfiles = false,
						hide_gitignored = true,
					},
				},
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
