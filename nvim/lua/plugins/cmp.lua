local sources = {
	{ name = "luasnip" },
	{ name = "nvim_lsp_signature_help" },
	{ name = "nvim_lsp" },
	{ name = "nvim_lua" },
	{ name = "buffer" },
	{ name = "path" },
	{ name = "cmp_tabnine" },
	{ name = "calc" },
	{ name = "emoji" },
	{
		name = "diag-codes",
		-- default completion available only in comment context
		-- use false if you want to get in other context
		option = { in_comment = true },
	},
}

local format = function(entry, item)
	-- Define menu shorthand for different completion sources.
	local menu_icon = {
		nvim_lsp = "NLSP",
		nvim_lua = "NLUA",
		luasnip = "LSNP",
		buffer = "BUFF",
		path = "PATH",
	}
	-- Set the menu "icon" to the shorthand for each completion source.
	item.menu = menu_icon[entry.source.name]

	-- Set the fixed width of the completion menu to 60 characters.
	-- fixed_width = 20

	-- Set 'fixed_width' to false if not provided.
	fixed_width = fixed_width or false

	-- Get the completion entry text shown in the completion window.
	local content = item.abbr

	-- Set the fixed completion window width.
	if fixed_width then
		vim.o.pumwidth = fixed_width
	end

	-- Get the width of the current window.
	local win_width = vim.api.nvim_win_get_width(0)

	-- Set the max content width based on either: 'fixed_width'
	-- or a percentage of the window width, in this case 20%.
	-- We subtract 10 from 'fixed_width' to leave room for 'kind' fields.
	local max_content_width = fixed_width and fixed_width - 10 or math.floor(win_width * 0.4)

	-- Truncate the completion entry text if it's longer than the
	-- max content width. We subtract 3 from the max content width
	-- to account for the "..." that will be appended to it.
	if #content > max_content_width then
		item.abbr = vim.fn.strcharpart(content, 0, max_content_width - 3) .. "..."
	else
		item.abbr = content .. (" "):rep(max_content_width - #content)
	end
	return item
end

return {
	"hrsh7th/nvim-cmp",
	event = { "InsertEnter", "CmdlineEnter" },
	dependencies = {
		"ray-x/lsp_signature.nvim",
		"L3MON4D3/LuaSnip",
		"JMarkin/cmp-diag-codes",
		"hrsh7th/cmp-nvim-lsp",
		"hrsh7th/cmp-nvim-lua",
		"hrsh7th/cmp-calc",
		"hrsh7th/cmp-emoji",
		"hrsh7th/cmp-buffer",
		"hrsh7th/cmp-path",
		"hrsh7th/cmp-cmdline",
		"dmitmel/cmp-cmdline-history",
		"saadparwaiz1/cmp_luasnip",
		"hrsh7th/cmp-nvim-lsp-signature-help",
		"hrsh7th/cmp-nvim-lsp-document-symbol",
	},
	config = function()
		require("cmp_nvim_lsp")
		require("cmp_buffer")
		require("cmp_nvim_lsp")
		require("cmp_nvim_lua")
		require("cmp_calc")
		require("cmp_emoji")
		require("cmp_luasnip")

		local cmp = require("cmp")
		cmp.setup({
			preselect = cmp.PreselectMode.None,
			snippet = {
				expand = function(args)
					require("luasnip").lsp_expand(args.body)
				end,
			},
			mapping = {
				["<cr>"] = cmp.mapping.confirm({
					select = true,
					behavior = cmp.ConfirmBehavior.replace,
				}),
				["<Tab>"] = cmp.mapping(function(fallback)
					print(vim.inspect(cmp.visible()))
					if cmp.visible() then
						cmp.select_next_item()
					else
						fallback()
					end
				end, {
					"i",
					"s",
				}),
				["<S-Tab>"] = cmp.mapping(function(fallback)
					if cmp.visible() then
						cmp.select_prev_item()
					else
						fallback()
					end
				end, {
					"i",
					"s",
				}),
				["<C-n>"] = cmp.mapping(function(fallback)
					print(vim.inspect(cmp.visible()))
					if cmp.visible() then
						cmp.select_next_item()
					else
						fallback()
					end
				end, {
					"i",
					"s",
				}),
				["C-p"] = cmp.mapping(function(fallback)
					if cmp.visible() then
						cmp.select_prev_item()
					else
						fallback()
					end
				end, {
					"i",
					"s",
				}),
			},
			window = {
				completion = cmp.config.window.bordered(),
				documentation = cmp.config.window.bordered(),
			},
			experimental = {
				native_menu = false,
				ghost_text = true,
			},
			sources = sources,
			formatting = {
				fields = { "abbr", "menu", "kind" },
				format = format,
			},
			completion = {
				completeopt = "menu,menuone,noinsert",
			},
		})

		for _, cmd_type in ipairs({ ":", "/", "?", "@" }) do
			cmp.setup.cmdline(cmd_type, {
				completion = { completeopt = "menu,menuone,noselect" },
				mapping = cmp.mapping.preset.cmdline(),
				sources = cmp.config.sources({
					{ name = "path" },
					{ name = "cmdline", option = { ignore_cmds = { "!" } } },
					{
						name = "buffer",
						keyword_length = 4,
						option = { keyword_pattern = anyWord },
					},
					{ name = "cmdline_history" },
				}),
				formatting = {
					formt = format,
				},
			})
		end

		require("lsp_signature").setup({})
	end,
}
