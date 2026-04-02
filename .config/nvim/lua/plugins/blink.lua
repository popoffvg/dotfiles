return {
	{
		"saghen/blink.cmp",
		-- optional: provides snippets for the snippet source
		dependencies = {
			"L3MON4D3/LuaSnip",
			{
				"saghen/blink.compat",
				-- use the latest release, via version = '*', if you also use the latest release for blink.cmp
				version = "*",
				-- lazy.nvim will automatically load the plugin when it's required by blink.cmp
				lazy = true,
				-- make sure to set opts so that lazy.nvim calls blink.compat's setup
				opts = {},
			},
		},

		-- use a release tag to download pre-built binaries
		version = "*",
		---@module 'blink.cmp'
		---@type blink.cmp.Config
		opts = {
			keymap = {
				preset = "default",
				["<C-f>"] = {
					function(cmp)
						vim.schedule(function()
							if not cmp.is_visible() then
								vim.api.nvim_feedkeys("\n", "n", true)
							end

							local ls = require("luasnip")
							if ls.expandable() then
								ls.expand()
							else
								cmp.select_and_accept()
							end
						end)
					end,
				},
				["<C-d>"] = { "show", "show_documentation", "hide_documentation" },
				["<CR>"] = {
					function(cmp)
						vim.schedule(function()
							if not cmp.is_visible() then
								vim.api.nvim_feedkeys("\n", "n", true)
							end

							local ls = require("luasnip")
							if ls.expandable() then
								ls.expand()
							else
								cmp.select_and_accept()
							end
						end)
					end,
				},
			},

			appearance = {
				-- Sets the fallback highlight groups to nvim-cmp's highlight groups
				-- Useful for when your theme doesn't support blink.cmp
				-- Will be removed in a future release
				use_nvim_cmp_as_default = true,
				-- Set to 'mono' for 'Nerd Font Mono' or 'normal' for 'Nerd Font'
				-- Adjusts spacing to ensure icons are aligned
				nerd_font_variant = "mono",
			},
			completion = {
				ghost_text = {
					enabled = false, -- only for ai assistant
				},
				list = {
					selection = { auto_insert = false },
				},
				accept = {
					-- experimental auto-brackets support
					auto_brackets = {
						enabled = true,
					},
				},
			},
			signature = { enabled = true },
			snippets = { preset = "luasnip" },
			-- Default list of enabled providers defined so that you can extend it
			-- elsewhere in your config, without redefining it, due to `opts_extend`
			sources = {
				default = {
					"snippets",
					"lsp",
					"buffer",
					"path",
				},
			},
			cmdline = {
				enabled = true,
				keymap = {
					["<c-f>"] = {
						"show",
						"accept",
					},
					["<Tab>"] = {
						"show",
						"accept",
					},
					["<c-p>"] = {
						"show_and_insert",
						"select_prev",
					},
					["<c-n>"] = {
						"show_and_insert",
						"select_next",
					},
				},
				completion = {
					menu = {
						auto_show = function(ctx)
							return vim.fn.getcmdtype() == ":"
							-- enable for inputs as well, with:
							-- or vim.fn.getcmdtype() == '@'
						end,
					},
				},
				-- sources = function()
				-- 	local type = vim.fn.getcmdtype()
				-- 	-- Search forward and backward
				-- 	if type == "/" or type == "?" then
				-- 		return { "buffer" }
				-- 	end
				-- 	-- Commands
				-- 	if type == ":" or type == "@" then
				-- 		return { "cmdline", "path" }
				-- 	end
				-- 	return {}
				-- end,
			},
		},
		opts_extend = {
			"sources.completion.enabled_providers",
			"sources.compat",
			"sources.default",
		},
	},
}
