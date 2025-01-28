return {
	-- {
	-- 	"saghen/blink.cmp",
	-- 	-- optional: provides snippets for the snippet source
	-- 	dependencies = {
	-- 		"L3MON4D3/LuaSnip",
	-- 		{
	-- 			"saghen/blink.compat",
	-- 			-- use the latest release, via version = '*', if you also use the latest release for blink.cmp
	-- 			version = "*",
	-- 			-- lazy.nvim will automatically load the plugin when it's required by blink.cmp
	-- 			lazy = true,
	-- 			-- make sure to set opts so that lazy.nvim calls blink.compat's setup
	-- 			opts = {},
	-- 		},
	-- 	},
	--
	-- 	-- use a release tag to download pre-built binaries
	-- 	version = "*",
	-- 	---@module 'blink.cmp'
	-- 	---@type blink.cmp.Config
	-- 	opts = {
	-- 		keymap = {
	-- 			preset = "default",
	-- 			["<C-f>"] = {
	-- 				function(cmp)
	-- 					vim.schedule(function()
	-- 						local ls = require("luasnip")
	-- 						if ls.expandable() then
	-- 							ls.expand()
	-- 						else
	-- 							cmp.select_and_accept()
	-- 						end
	-- 					end)
	-- 				end,
	-- 			},
	-- 			["<C-d>"] = { "show", "show_documentation", "hide_documentation" },
	-- 			["<CR>"] = { "select_and_accept" },
	-- 		},
	--
	-- 		appearance = {
	-- 			-- Sets the fallback highlight groups to nvim-cmp's highlight groups
	-- 			-- Useful for when your theme doesn't support blink.cmp
	-- 			-- Will be removed in a future release
	-- 			use_nvim_cmp_as_default = true,
	-- 			-- Set to 'mono' for 'Nerd Font Mono' or 'normal' for 'Nerd Font'
	-- 			-- Adjusts spacing to ensure icons are aligned
	-- 			nerd_font_variant = "mono",
	-- 		},
	-- 		completion = {
	-- 			ghost_text = {
	-- 				enabled = false, -- only for ai assistant
	-- 			},
	-- 			list = {
	-- 				selection = "auto_insert",
	-- 			},
	-- 			accept = {
	-- 				-- experimental auto-brackets support
	-- 				auto_brackets = {
	-- 					enabled = true,
	-- 				},
	-- 			},
	-- 		},
	-- 		signature = { enabled = true },
	-- 		snippets = {
	-- 			expand = function(snippet)
	-- 				require("luasnip").lsp_expand(snippet)
	-- 			end,
	-- 			active = function(filter)
	-- 				if filter and filter.direction then
	-- 					return require("luasnip").jumpable(filter.direction)
	-- 				end
	-- 				return require("luasnip").in_snippet()
	-- 			end,
	-- 			jump = function(direction)
	-- 				require("luasnip").jump(direction)
	-- 			end,
	-- 		},
	--
	-- 		-- Default list of enabled providers defined so that you can extend it
	-- 		-- elsewhere in your config, without redefining it, due to `opts_extend`
	-- 		sources = {
	-- 			default = {
	-- 				"lsp",
	-- 				"path",
	-- 				"luasnip",
	-- 				-- "snippets",
	-- 				"buffer",
	-- 			},
	-- 			cmdline = {},
	-- 		},
	-- 	},
	-- 	opts_extend = {
	-- 		"sources.completion.enabled_providers",
	-- 		"sources.compat",
	-- 		"sources.default",
	-- 	},
	-- },
}
