local routes = {
	{
		view = "split",
		filter = { event = "msg_show", min_height = 20 },
	},
	{
		filter = { event = "msg_show", kind = "confirm" },
		opts = { skip = true },
	},
	{
		filter = { event = "msg_show", kind = "" },
		opts = { skip = true },
	},
	{
		filter = { event = "msg_show", kind = "lua_error" },
		opts = { skip = true },
	},
	{
		filter = {
			event = "lsp",
			kind = "progress",
			find = "code_action", -- skip all lsp progress containing the word workspace
		},
		opts = { skip = true },
	},
	{
		filter = {
			event = "lsp",
			kind = "progress",
			find = "diagnostics_on_open", -- skip all lsp progress containing the word workspace
		},
		opts = { skip = true },
	},
	{
		filter = {
			event = "notify.error",
		},
		opts = { skip = true },
	},
}

table.insert(routes, require("plugins.languages.go").Routes)

return {

	-- CMD custimization
	{
		-- ast place
		"SmiteshP/nvim-navic",
		lazy = false,
		config = function()
			local navic = require("nvim-navic")
			navic.setup({
				icons = {
					File = " ",
					Module = " ",
					Namespace = " ",
					Package = " ",
					Class = " ",
					Method = " ",
					Property = " ",
					Field = " ",
					Constructor = " ",
					Enum = " ",
					Interface = " ",
					Function = " ",
					Variable = " ",
					Constant = " ",
					String = " ",
					Number = " ",
					Boolean = " ",
					Array = " ",
					Object = " ",
					Key = " ",
					Null = " ",
					EnumMember = " ",
					Struct = " ",
					Event = " ",
					Operator = " ",
					TypeParameter = " ",
				},
			})
		end,
	},
	{
		"rcarriga/nvim-notify",
		event = "VeryLazy",
		config = function()
			require("notify").setup({
				stages = "fade",
				timeout = 3000,
				background_colour = "#000000",
				top_down = false,
				render = "wrapped-compact",
				max_width = function()
					local cols = vim.o.columns
					return math.floor(cols * 0.3)
				end,
			})
		end,
	},
	-- {
	-- 	-- messagaes and cmd new UI
	-- 	"folke/noice.nvim",
	-- 	event = "VeryLazy",
	-- 	dependecies = {
	-- 		"SmiteshP/nvim-navic",
	--
	-- 		"MunifTanjim/nui.nvim",
	-- 		"kyazdani42/nvim-web-devicons",
	-- 	},
	-- 	config = function()
	-- 		require("noice").setup({
	-- 			lsp = {
	-- 				progress = {
	-- 					enabled = true,
	-- 				},
	-- 				-- override = {
	-- 				-- 	-- override the default lsp markdown formatter with Noice
	-- 				-- 	["vim.lsp.util.convert_input_to_markdown_lines"] = false,
	-- 				-- 	-- override the lsp markdown formatter with Noice
	-- 				-- 	["vim.lsp.util.stylize_markdown"] = false,
	-- 				-- 	-- override cmp documentation with Noice (needs the other options to work)
	-- 				-- 	["cmp.entry.get_documentation"] = false,
	-- 				-- },
	-- 				hover = {
	-- 					enabled = false,
	-- 				},
	-- 				signature = {
	-- 					enabled = false,
	-- 				},
	-- 				message = {
	-- 					-- Messages shown by lsp servers
	-- 					enabled = true,
	-- 					view = "notify",
	-- 					opts = {},
	-- 				},
	-- 				-- defaults for hover and signature help
	-- 				documentation = {
	-- 					view = "hover",
	-- 					---@type NoiceViewOptions
	-- 					opts = {
	-- 						lang = "markdown",
	-- 						replace = true,
	-- 						render = "plain",
	-- 						format = { "{message}" },
	-- 						win_options = { concealcursor = "n", conceallevel = 3 },
	-- 					},
	-- 				},
	-- 			},
	-- 			routes = routes,
	-- 			presets = {
	-- 				bottom_search = false, -- use a classic bottom cmdline for search
	-- 				command_palette = true, -- position the cmdline and popupmenu together
	-- 				long_message_to_split = false, -- long messages will be sent to a split
	-- 				inc_rename = false, -- enables an input dialog for inc-rename.nvim
	-- 				lsp_doc_border = false, -- add a border to hover docs and signature help
	-- 			},
	-- 			messages = {
	-- 				enabled = false, -- enables the Noice messages UI
	-- 				view = "mini", -- default view for messages
	-- 				view_error = "notify", -- view for errors
	-- 				view_warn = "notify", -- view for warnings
	-- 				view_history = "messages", -- view for :messages
	-- 				view_search = "virtualtext", -- view for search count messages. Set to `false` to disable
	-- 			},
	-- 			view = {
	-- 				views = {
	-- 					cmdline_popup = {
	-- 						backend = "popup",
	-- 						relative = "editor",
	-- 						position = {
	-- 							row = "60%", -- 40% from top of the screen. This will position it almost at the center.
	-- 							col = "40%",
	-- 						},
	-- 						size = {
	-- 							width = 120,
	-- 							height = "auto",
	-- 						},
	-- 						win_options = {
	-- 							winhighlight = {
	-- 								Normal = "NoiceCmdlinePopup",
	-- 								FloatTitle = "NoiceCmdlinePopupTitle",
	-- 								FloatBorder = "NoiceCmdlinePopupBorder",
	-- 								IncSearch = "",
	-- 								CurSearch = "",
	-- 								Search = "",
	-- 							},
	-- 							winbar = "",
	-- 							foldenable = false,
	-- 							cursorline = false,
	-- 						},
	-- 					},
	-- 					popupmenu = {
	-- 						relative = "editor",
	-- 						position = {
	-- 							row = "50%", -- Popup will show up below the cmdline automatically
	-- 							col = "40%",
	-- 						},
	-- 						size = {
	-- 							width = 120,
	-- 							height = "auto",
	-- 						},
	-- 						border = {
	-- 							style = "rounded",
	-- 							padding = { 0, 1 },
	-- 						},
	-- 						win_options = {
	-- 							winhighlight = { Normal = "Normal", FloatBorder = "DiagnosticInfo" },
	-- 						},
	-- 					},
	-- 					cmdline = {
	-- 						view = "cmdline_popup", -- cmdline_popup, cmdline
	-- 					},
	-- 				},
	-- 			},
	-- 			-- it works
	-- 			-- views = {
	-- 			-- 	hover = {
	-- 			-- 		size = {
	-- 			-- 			max_width = 1,
	-- 			-- 		},
	-- 			-- 		border = {
	-- 			-- 			style = "rounded",
	-- 			-- 		},
	-- 			-- 		position = { row = 2, col = 2 },
	-- 			-- 	},
	-- 			-- },
	-- 		})
	-- 	end,
	-- },
	{
		-- for nvim builin ui elements
		"stevearc/dressing.nvim",
		opts = {},
	},
	{
		"folke/todo-comments.nvim",
		dependencies = { "nvim-lua/plenary.nvim" },
		opts = {
			-- your configuration comes here
			-- or leave it empty to use the default settings
			-- refer to the configuration section below
		},
	},
	{
		-- zen mod
		"pocco81/true-zen.nvim",
		dependencies = {
			{
				"folke/twilight.nvim",
				opts = {
					context = 10,
				},
			},
		},
		keys = {
			{ "<leader>zs", ":TZNarrow<CR>", mode = { "n" } },
			{ "<leader>zs", ":'<,'>TZNarrow<CR>", mode = { "v" } },
			{ "<leader>zz", ":TZAtaraxis<CR>", mode = { "n" } },
			{
				"<leader>zd",
				function()
					require("twilight.view").toggle()
				end,
				mode = { "n" },
			},
		},

		opts = {
			integrations = {
				tmux = true, -- hide tmux status bar in (minimalist, ataraxis)
				lualine = true, -- hide nvim-lualine (ataraxis)
				twilight = false,
			},
			modes = {
				ataraxis = {
					padding = { -- padding windows
						left = 35,
						right = 35,
						top = 0,
						bottom = 0,
					},
				},
				narrow = {
					--- change the style of the fold lines. Set it to:
					--- `informative`: to get nice pre-baked folds
					--- `invisible`: hide them
					--- function() end: pass a custom func with your fold lines. See :h foldtext
					run_ataraxis = true,
					folds_style = "invisible",
					options = {
						number = true,
					},
					open_pre = function()
						require("twilight.view").disable()
					end,
				},
				minimalist = {
					options = {
						number = true,
						statusline = " ",
						list = false,
					},
				},
			},
		},
	},
	-- {
	-- 	-- closed buffer after x minutes
	-- 	"chrisgrieser/nvim-early-retirement",
	-- 	config = true,
	-- 	event = "VeryLazy",
	-- },
	-- {
	-- 	"b0o/incline.nvim",
	-- 	config = function()
	-- 		require("incline").setup({
	-- 			debounce_threshold = { falling = 500, rising = 250 },
	-- 			render = function(props)
	-- 				if vim.fn.winnr("$") <= 1 then -- more than one split open?
	-- 					return {}
	-- 				end
	-- 				local bufname = vim.api.nvim_buf_get_name(props.buf)
	-- 				local filename = vim.fn.fnamemodify(bufname, ":t")
	-- 				-- local diagnostics = get_diagnostic_label(props)
	-- 				local modified = vim.api.nvim_buf_get_option(props.buf, "modified") and "bold,italic" or "None"
	-- 				local filetype_icon, color = require("nvim-web-devicons").get_icon_color(filename)
	--
	-- 				return {
	-- 					{ filetype_icon, guifg = color },
	-- 					{ " " },
	-- 					{ filename, gui = modified },
	-- 				}
	-- 			end,
	-- 		})
	-- 	end,
	-- },
	{
		"neovim/nvim-lspconfig",
		-- your lsp config or other stuff
	},
	{
		"simrat39/symbols-outline.nvim",
		config = function()
			require("symbols-outline").setup()
		end,
	},
	-- start screen
	-- {
	-- 	"goolord/alpha-nvim",
	-- 	config = function()
	-- 		require("alpha").setup(require("alpha.themes.dashboard").config)
	-- 	end,
	-- },
	{
		"cameron-wags/rainbow_csv.nvim",
		config = true,
		ft = {
			"csv",
			"tsv",
			"csv_semicolon",
			"csv_whitespace",
			"csv_pipe",
			"rfc_csv",
			"rfc_semicolon",
		},
		cmd = {
			"RainbowDelim",
			"RainbowDelimSimple",
			"RainbowDelimQuoted",
			"RainbowMultiDelim",
		},
	},
	{ "shortcuts/no-neck-pain.nvim", confuig = true },
	{
		"chentoast/marks.nvim",
		event = "VeryLazy",
		opts = {},
	},
	{
		"crusj/bookmarks.nvim",
		keys = {
			{
				"<leader>b",
				function()
					require("bookmarks").toggle_bookmarks()
				end,
				mode = { "n" },
			},
			{
				"<c-b>",
				function()
					require("bookmarks").add_bookmarks(false)
				end,
				mode = { "n" },
			},
		},
		branch = "main",
		dependencies = { "nvim-web-devicons" },
		config = function()
			require("bookmarks").setup()
			require("telescope").load_extension("bookmarks")
		end,
	},
	-- {
	--
	-- 	"luukvbaal/statuscol.nvim",
	-- 	dependecies = {
	-- 		"nvim-dap",
	-- 		"gitsigns.nvim",
	-- 	},
	-- 	config = function()
	-- 		-- local builtin = require("statuscol.builtin")
	-- 		require("statuscol").setup({ -- configuration goes here, for example:
	-- 			segments = {
	-- 				text = "",
	-- 				condition = {
	-- 					function()
	-- 						local result = false
	-- 						local action = function()
	-- 							local lsp = vim.lsp
	-- 							local bufnr = vim.api.nvim_get_current_buf()
	-- 							local parameter = lsp.util.make_position_params()
	-- 							lsp.buf_request(
	-- 								bufnr,
	-- 								"textDocument/codeLens",
	-- 								parameter,
	-- 								function(err, response, ctx, _)
	-- 									if err then
	-- 										print("codelens" .. vim.inspect(err))
	-- 										return
	-- 									end
	-- 									print("test" .. vim.inspect(#response))
	-- 									result = #response > 0
	-- 								end
	-- 							)
	-- 						end
	-- 						local status, err = pcall(action)
	-- 						if status then
	-- 							return result
	-- 						else
	-- 							print("handling error" .. vim.inspect(err))
	-- 						end
	-- 					end,
	-- 				},
	-- 				sign = { -- table of fields that configure a sign segment
	-- 					-- name = { ".*" }, -- table of lua patterns to match the sign name against
	-- 					-- text = { ".*" }, -- table of lua patterns to match the extmark sign text against
	-- 					-- namespace = { ".*" }, -- table of lua patterns to match the extmark sign namespace against
	-- 					-- -- below values list the default when omitted:
	-- 					-- maxwidth = 1, -- maximum number of signs that will be displayed in this segment
	-- 					-- colwidth = 2, -- number of display cells per sign in this segment
	-- 					-- auto = true, -- when true, the segment will not be drawn if no signs matching
	-- 					-- -- the pattern are currently placed in the buffer.
	-- 					-- wrap = false, -- when true, signs in this segment will also be drawn on the
	-- 					-- -- virtual or wrapped part of a line (when v:virtnum != 0).
	-- 					-- fillchar = "1", -- character used to fill a segment with less signs than maxwidth
	-- 					-- fillcharhl = "SignColumn", -- highlight group used for fillchar (SignColumn/CursorLineSign if omitted)
	-- 				},
	-- 			},
	-- 		})
	-- 	end,
	-- },
	-- {
	-- 	"kevinhwang91/nvim-ufo",
	-- 	dependencies = { "kevinhwang91/promise-async", "nvim-treesitter/nvim-treesitter" },
	-- 	config = function()
	-- 		vim.o.foldcolumn = "1" -- '0' is not bad
	-- 		vim.o.foldlevel = 99 -- Using ufo provider need a large value, feel free to decrease the value
	-- 		vim.o.foldlevelstart = 99
	-- 		vim.o.foldenable = true
	-- 		require("ufo").setup({
	-- 			open_fold_hl_timeout = 50,
	-- 			close_fold_kinds_for_ft = {
	-- 				default = { "imports", "comment" },
	-- 				json = { "array" },
	-- 				c = { "comment", "region" },
	-- 			},
	-- 			preview = {
	-- 				win_config = {
	-- 					border = { "", "─", "", "", "", "─", "", "" },
	-- 					winhighlight = "Normal:Folded",
	-- 					winblend = 0,
	-- 				},
	-- 				mappings = {
	-- 					scrollU = "<C-u>",
	-- 					scrollD = "<C-d>",
	-- 					jumpTop = "[",
	-- 					jumpBot = "]",
	-- 				},
	-- 			},
	-- 			provider_selector = function(bufnr, filetype, buftype)
	-- 				return { "treesitter", "indent" }
	-- 			end,
	-- 		})
	-- 	end,
	-- },
	-- {
	-- 	"rachartier/tiny-inline-diagnostic.nvim",
	-- 	event = "LspAttach", -- Or `LspAttach`
	-- 	priority = 1000, -- needs to be loaded in first
	-- 	config = function()
	-- 		vim.diagnostic.config({ virtual_text = false })
	-- 		require("tiny-inline-diagnostic").setup()
	-- 	end,
	-- },
	{
		"OXY2DEV/helpview.nvim",
		lazy = false, -- Recommended

		-- In case you still want to lazy load
		-- ft = "help",

		dependencies = {
			"nvim-treesitter/nvim-treesitter",
		},
	},
}
