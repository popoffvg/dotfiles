local format = function(entry, item)
	-- Define menu shorthand for different completion sources.
	local menu_icon = {
		nvim_lsp = "LSP",
		nvim_lua = "NVIM",
		luasnip = "SNIP",
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

local formatV2 = function(entry, vim_item)
	local cmputils = require("plugins.cmputils.format")
	if vim.bo.filetype == "rust" then
		return cmputils.Rust(entry, vim_item)
	elseif vim.bo.filetype == "lua" then
		return cmputils.Lua(entry, vim_item)
	elseif vim.bo.filetype == "go" then
		local item = cmputils.Go(entry, vim_item)
		return item
	else
		return cmputils.Common(entry, vim_item)
	end
end

local lspkind_comparator = function(conf)
	local lsp_types = require("cmp.types").lsp
	return function(entry1, entry2)
		if entry1.source.name ~= "nvim_lsp" then
			if entry2.source.name == "nvim_lsp" then
				return false
			else
				return nil
			end
		end
		local kind1 = lsp_types.CompletionItemKind[entry1:get_kind()]
		local kind2 = lsp_types.CompletionItemKind[entry2:get_kind()]
		if kind1 == "Variable" and entry1:get_completion_item().label:match("%w*=") then
			kind1 = "Parameter"
		end
		if kind2 == "Variable" and entry2:get_completion_item().label:match("%w*=") then
			kind2 = "Parameter"
		end

		local priority1 = conf.kind_priority[kind1] or 0
		local priority2 = conf.kind_priority[kind2] or 0
		if priority1 == priority2 then
			return nil
		end
		return priority2 < priority1
	end
end

local label_comparator = function(entry1, entry2)
	return entry1.completion_item.label < entry2.completion_item.label
end

local kind_comparator_settings = {
	kind_priority = {
		Parameter = 14,
		Variable = 12,
		Field = 11,
		Property = 11,
		Constant = 10,
		Enum = 10,
		EnumMember = 10,
		Event = 10,
		Function = 10,
		Method = 10,
		Operator = 10,
		Reference = 10,
		Struct = 10,
		File = 8,
		Folder = 8,
		Class = 5,
		Color = 5,
		Module = 5,
		Keyword = 2,
		Constructor = 1,
		Interface = 1,
		Snippet = 0,
		Text = 0,
		TypeParameter = 1,
		Unit = 1,
		Value = 1,
	},
}

return {
	{
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
			{
				"tzachar/fuzzy.nvim",
				"tzachar/cmp-fuzzy-buffer",
				dependencies = { "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
			},
			"chrisgrieser/cmp_yanky",
			"ray-x/cmp-treesitter",
			-- {
			-- 	"tzachar/cmp-tabnine",
			-- 	build = "./install.sh",
			-- 	dependencies = "hrsh7th/nvim-cmp",
			-- },
		},
		config = function()
			require("cmp_luasnip")
			require("cmp_nvim_lsp")
			require("cmp_buffer")
			-- require("cmp_calc")
			-- require("cmp_emoji")
			require("cmp_nvim_lua")

			local sources = {
				-- { name = "cmp_tabnine", priority = 300 },
				{ name = "luasnip", priority = 200 },
				{ name = "nvim_lsp_signature_help", priority = 11 },
				{ name = "nvim_lsp", priority = 10 },
				{ name = "nvim_lua", priority = 10 },
				{ name = "otter", priority = 10 },
				{
					name = "diag-codes",
					priority = 7,
					-- default completion available only in comment context
					-- use false if you want to get in other context
					option = { in_comment = true },
				},
				-- { name = "fuzzy_buffer" },
				{ name = "treesitter", priority = 2 },
				{ name = "buffer", priority = 1 },
				{ name = "path", priority = 1 },
				-- { name = "cmp_yanky" },
				-- { name = "calc" },
				-- { name = "emoji" },
			}

			local cmp = require("cmp")
			local confirm = cmp.mapping(function(fallback)
				if cmp.visible() then
					cmp.confirm({
						select = true,
						behavior = cmp.ConfirmBehavior.replace,
					})
					-- vim.api.nvim_input("<esc>")
				else
					fallback()
				end
			end)
			local keymap = cmp.mapping.preset.insert({
				["<cr>"] = confirm,
				["<C-f>"] = confirm,
				["<C-d>"] = cmp.mapping(function(fallback)
					if cmp.visible_docs() then
						cmp.close_docs()
					else
						cmp.open_docs()
					end
				end),
				["<Tab>"] = cmp.config.disable,
				["<S-Tab>"] = cmp.config.disable,
				["<ESC>"] = function(fallsback)
					if cmp.visible() then
						cmp.close()
						fallsback()
					else
						fallsback()
					end
				end,
				["<C-n>"] = function(fallback)
					if cmp.visible() then
						cmp.select_next_item()
					else
						fallback()
					end
				end,
				["C-p"] = function(fallback)
					if cmp.visible() then
						cmp.select_prev_item()
					else
						fallback()
					end
				end,
			})
			cmp.setup({
				appearance = {
					menu = {
						direction = "auto", -- auto or above or below
					},
				},
				view = {
					entries = "custom", -- custom, native
					docs = {
						auto_open = false,
					},
				},
				preselect = cmp.PreselectMode.None,
				snippet = {
					expand = function(args)
						require("luasnip").lsp_expand(args.body)
					end,
				},
				mapping = keymap,
				window = {
					completion = cmp.config.window.bordered(),
					documentation = cmp.config.window.bordered(),
				},
				experimental = {
					ghost_text = false,
					-- native_menu = true,
				},
				sources = sources,
				formatting = {
					fields = { "kind", "abbr", "menu" },
					format = formatV2,
				},
				completion = {
					completeopt = "menu,menuone,noinsert",
				},
				sorting = {
					comparators = {
						lspkind_comparator(kind_comparator_settings),
						cmp.config.compare.score,
						label_comparator,
						cmp.config.compare.sort_text,
						-- cmp.config.compare.order,
						cmp.config.compare.recently_used,
						cmp.config.compare.length,
						-- require("cmp_fuzzy_buffer.compare"),
						-- cmp.config.compare.offset,
					},
				},
			})
			for _, cmd_type in ipairs({ ":", "@" }) do
				cmp.setup.cmdline(cmd_type, {
					view = {
						entries = "custom",
					},
					completion = { completeopt = "menu,menuone,noselect" },
					mapping = cmp.mapping.preset.cmdline({
						["<C-f>"] = cmp.mapping.confirm({
							select = true,
							behavior = cmp.ConfirmBehavior.replace,
						}),
					}),
					sources = cmp.config.sources({
						{ name = "path" },
						{ name = "cmdline", option = { ignore_cmds = { "!" } } },
						{ name = "cmdline_history" },
					}),
					formatting = {
						formt = format,
					},
				})
			end
			for _, cmd_type in ipairs({ "/", "?" }) do
				cmp.setup.cmdline(cmd_type, {
					view = {
						entries = "custom",
					},
					completion = { completeopt = "menu,menuone,noselect" },
					mapping = cmp.mapping.preset.cmdline({
						["<C-f>"] = cmp.mapping.confirm({
							select = true,
							behavior = cmp.ConfirmBehavior.replace,
						}),
					}),
					sources = cmp.config.sources({
						{
							name = "fuzzy_buffer",
							keyword_length = 4,
							option = { keyword_pattern = anyWord },
						},
						{ name = "path" },
					}),
					formatting = {
						formt = format,
					},
				})
				::continue::
			end

			require("lsp_signature").setup({})
		end,
	},
	{
		-- sql suggestions
		"jmbuhr/otter.nvim",
		dependencies = {
			"hrsh7th/nvim-cmp", -- optional, for completion
			"neovim/nvim-lspconfig",
			"nvim-treesitter/nvim-treesitter",
		},
		config = function()
			-- table of embedded languages to look for.
			-- required (no default)
			local languages = { "sql" }

			-- enable completion/diagnostics
			-- defaults are true
			local completion = true
			local diagnostics = true
			-- treesitter query to look for embedded languages
			-- uses injections if nil or not set
			local tsquery = nil

			require("otter").activate(languages, completion, diagnostics, tsquery)
		end,
	},
}
