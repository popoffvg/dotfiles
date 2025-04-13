local mason_servers = {
	"lua_ls",
	"bashls",
	-- "gopls",
	"yamlls",
	-- "tsserver",
	"phpactor",
	"pylsp",
	"pyright",
	"golangci_lint_ls",
	"bufls",
	"harper_ls",
	-- "volar",
	-- ltex for markdown
	-- cspell
}

local signs = {
	Error = "",
	Warn = "",
	Info = "",
	Hint = "💡",
}
-- LSP settings (for overriding per client)
local handlers = {
	["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, { border = "rounded" }),
	["textDocument/signatureHelp"] = vim.lsp.with(vim.lsp.handlers.signature_help, {
		floating_window = false,
		border = "rounded",
	}),
	["textDocument/publishDiagnostics"] = vim.lsp.with(vim.lsp.diagnostic.on_publish_diagnostics, {
		virtual_text = false,
	}),
}

local on_attach = function()
	return function(client, bufnr)
		vim.api.nvim_buf_set_option(bufnr, "omnifunc", "v:lua.vim.lsp.omnifunc")

		if client.name == "null-ls" or client.name == "harper_ls" then
			return
		end
		if client.name == "gopls" and not client.server_capabilities.semanticTokensProvider then
			local semantic = client.config.capabilities.textDocument.semanticTokens
			client.server_capabilities.semanticTokensProvider = {
				full = true,
				legend = { tokenModifiers = semantic.tokenModifiers, tokenTypes = semantic.tokenTypes },
				range = true,
			}
			client.server_capabilities.publishDiagnostics = false
		end
		require("nvim-navic").attach(client, bufnr)
		vim.api.nvim_command("autocmd CursorHold <buffer> lua vim.diagnostic.open_float({focusable = false})")
	end
end
local function setup_lsp_diags()
	vim.lsp.handlers["textDocument/publishDiagnostics"] = vim.lsp.with(vim.lsp.diagnostic.on_publish_diagnostics, {
		virtual_text = false,
		signs = true,
		update_in_insert = false,
		underline = true,
	})
end

local setup_goimports = function()
	vim.api.nvim_create_autocmd("BufWritePre", {
		pattern = "*.go",
		callback = function()
			local params = vim.lsp.util.make_range_params()
			params.context = { only = { "source.organizeImports" } }
			-- buf_request_sync defaults to a 1000ms timeout. Depending on your
			-- machine and codebase, you may want longer. Add an additional
			-- argument after params if you find that you have to write the file
			-- twice for changes to be saved.
			-- E.g., vim.lsp.buf_request_sync(0, "textDocument/codeAction", params, 3000)
			local err, result = pcall(vim.lsp.buf_request_sync(0, "textDocument/codeAction", params))
			if not err then
				return
			end
			for cid, res in pairs(result or {}) do
				for _, r in pairs(res.result or {}) do
					if r.edit then
						local enc = (vim.lsp.get_client_by_id(cid) or {}).offset_encoding or "utf-16"
						vim.lsp.util.apply_workspace_edit(r.edit, enc)
					end
				end
			end
			vim.lsp.buf.format({ async = false })
		end,
	})
end

return {
	{
		"neovim/nvim-lspconfig",
		dependencies = {
			{
				"nvimtools/none-ls.nvim",
				config = function() end,
			},
			-- "nanotee/sqls.nvim",
			"davidmh/cspell.nvim",
			"williamboman/mason.nvim",
			"SmiteshP/nvim-navic",
			"williamboman/mason-lspconfig.nvim",
			{
				-- Additional lua configuration, makes nvim stuff amazing!
				"folke/neodev.nvim",
				opts = {
					library = { plugins = { "nvim-dap-ui" }, types = true },
				},
			},
			{
				"MysticalDevil/inlay-hints.nvim",
				event = "LspAttach",
				dependencies = { "neovim/nvim-lspconfig" },
				config = function()
					require("inlay-hints").setup()
				end,
			},
			-- Interaction between cmp and lspconfig
			-- "hrsh7th/cmp-nvim-lsp",

			-- {
			-- 	-- show usages
			-- 	"Wansmer/symbol-usage.nvim",
			-- 	event = "BufReadPre", -- need run before LspAttach if you use nvim 0.9. On 0.10 use 'LspAttach'
			-- 	config = function()
			-- 		local function text_format(symbol)
			-- 			local fragments = {}
			--
			-- 			if symbol.references then
			-- 				local usage = symbol.references <= 1 and "usage" or "usages"
			-- 				local num = symbol.references == 0 and "no" or symbol.references
			-- 				table.insert(fragments, ("%s %s"):format(num, usage))
			-- 			end
			--
			-- 			if symbol.definition then
			-- 				table.insert(fragments, symbol.definition .. " defs")
			-- 			end
			--
			-- 			if symbol.implementation then
			-- 				table.insert(fragments, symbol.implementation .. " impls")
			-- 			end
			--
			-- 			return table.concat(fragments, ", ")
			-- 		end
			--
			-- 		require("symbol-usage").setup({
			-- 			text_format = text_format,
			-- 		})
			-- 	end,
			-- },
		},
		event = { "BufReadPre", "BufNewFile" },
		config = function(_, opts)
			-- local cmp = require("cmp_nvim_lsp")
			-- local capabilities = cmp.default_capabilities(make_client_capabilities())
			local capabilities = vim.lsp.protocol.make_client_capabilities()
			vim.lsp.handlers["textDocument/hover"] =
				vim.lsp.with(vim.lsp.handlers.hover, { focusable = false, float = true })

			require("mason-lspconfig").setup_handlers({
				function(server_name)
					local ok, settings = pcall(require, "plugins.lsp." .. server_name)
					if not ok then
						print("not found settings for " .. server_name)
						return
					end
					require("lspconfig")[server_name].setup({
						on_attach = on_attach(),
						settings = settings,
						handlers = handlers,
					})
				end,
			})
			require("mason-lspconfig").setup({
				ensure_installed = mason_servers,
			})
			-- doesn't work through mason
			-- require("lspconfig").sqls.setup({
			-- 	on_attach = function(client, bufnr)
			-- 		client.server_capabilities.documentFormattingProvider = false
			-- 		client.server_capabilities.documentRangeFormattingProvider = false
			-- 		require("sqls").on_attach(client, bufnr)
			-- 	end,
			-- 	settings = {
			-- 		sqls = {
			-- 			connections = {
			-- 				{
			-- 					alias = "dev-platfrom",
			-- 					driver = "mysql",
			-- 					dataSourceName = "root:dJgadn4PxPMSWJYJM5k5@(localhost:3306)/payment_provider",
			-- 				},
			-- 				{
			-- 					alias = "localhost",
			-- 					driver = "mysql",
			-- 					dataSourceName = "root:password@(localhost:28004)/payment_provider",
			-- 				},
			-- 			},
			-- 		},
			-- 	},
			-- })
			-- volar setup

			local tsserver = require("plugins.lsp.tsserver")
			tsserver.setup(capabilities, handlers, on_attach)
			local volar = require("plugins.lsp.volar")
			volar.setup(capabilities, handlers, on_attach)

			setup_goimports()
			setup_lsp_diags()

			for type, icon in pairs(signs) do
				local hl = "DiagnosticSign" .. type
				vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = "" })
			end

			local cspell = require("cspell")
			local null_ls = require("null-ls")

			null_ls.setup({
				on_attach = on_attach(),
				filetypes = "go",
				sources = {
					cspell.diagnostics.with({
						filetypes = { "go" },
						diagnostics_postprocess = function(diagnostic)
							diagnostic.severity = vim.diagnostic.severity["WARN"]
						end,
					}),
					cspell.code_actions,
					null_ls.builtins.completion.spell,
				},
			})
			local lspconfig = require("lspconfig")
			local configs = require("lspconfig/configs")

			lspconfig.gopls.setup({
				on_attach = on_attach(),
				-- capabilities = capabilities,
				settings = require("plugins.lsp.gopls"),
			})

			if not configs.golangcilsp then
				configs.golangcilsp = {
					default_config = {
						cmd = { "golangci-lint-langserver" },
						root_dir = lspconfig.util.root_pattern(".git", "go.mod"),
						init_options = {
							command = {
								"golangci-lint",
								"run",
								"--enable-all",
								"--disable",
								"lll",
								"--out-format",
								"json",
								"--issues-exit-code=1",
							},
						},
					},
				}
			end
			lspconfig.golangci_lint_ls.setup({
				filetypes = { "go", "gomod" },
			})

			-- vim.api.nvim_create_autocmd("CursorHold", {
			-- 	pattern = { "*" },
			-- 	callback = function()
			-- 		if not require("cmp").visible() then
			-- 			vim.api.nvim_command("set eventignore=CursorHold")
			-- 			vim.lsp.buf.hover()
			-- 			vim.api.nvim_command('autocmd CursorMoved <buffer> ++once set eventignore=""')
			-- 		end
			-- 	end,
			-- })
			--
		end,
		keys = {
			-- {
			-- 	"<leader>x",
			-- 	function()
			-- 		vim.diagnostic.open_float()
			-- 	end,
			-- },
			{
				"gt",
				function()
					vim.lsp.buf.type_definition({
						on_list = function()
							vim.cmd("Telescope lsp_type_definitions")
						end,
					})
				end,
			},
			{ "<Leader>fx", "<cmd>lua vim.diagnostic.setloclist()<CR>" },
			{ "<C-d>", "<cmd>lua vim.lsp.buf.signature_help()<CR>", mode = { "i" } },
			-- https://www.reddit.com/r/neovim/comments/11axh2p/how_to_toggle_openclose_floating_lsp_diagnostic/
			{ "<c-'>", '<cmd>lua vim.diagnostic.open_float(nil, {focus=true, scope="cursor"})<CR>' },
			{
				"<leader>rn",
				function()
					vim.lsp.buf.rename()
				end,
			},
			{
				"<leader>ca",
				function()
					vim.lsp.buf.code_action()
				end,
				mode = { "n", "v" },
			},
		},
	},
	-- {
	-- 	"mfussenegger/nvim-lint",
	-- 	config = function()
	-- 		require("lint").linters_by_ft = {
	-- 			markdown = { "vale" },
	-- 			go = { "golangcilint" },
	-- 		}
	-- 		vim.api.nvim_create_autocmd({ "BufWinEnter", "BufWritePost" }, {
	-- 			callback = function()
	-- 				require("lint").try_lint()
	-- 			end,
	-- 		})
	-- 	end,
	-- },
	-- {
	-- 	"folke/trouble.nvim",
	-- 	dependencies = { "nvim-tree/nvim-web-devicons" },
	-- 	opts = {
	-- 		-- auto_open = true,
	-- 		-- your configuration comes here
	-- 		-- or leave it empty to use the default settings
	-- 		-- refer to the configuration section below
	-- 	},
	-- 	keys = {
	-- 		{
	-- 			"<leader>xw",
	-- 			"<cmd>Trouble diagnostics toggle<CR>",
	-- 			desc = "workspace diagonstics",
	-- 		},
	-- 		{
	-- 			"<leader>xd",
	-- 			"<cmd>Trouble diagnostics toggle filter.buf=0<CR>",
	-- 			desc = "document diagonstics",
	-- 		},
	-- 	},
	-- },
	-- {
	-- 	"popoffvg/lsp_lines.nvim",
	-- 	config = function()
	-- 		vim.diagnostic.config({
	-- 			virtual_text = false,
	-- 			virtual_lines = { only_current_line = true },
	-- 		})
	-- 		require("lsp_lines").setup()
	-- 	end,
	-- },
	{
		"smjonas/inc-rename.nvim",
		event = "BufEnter",
		config = function()
			require("inc_rename").setup({})
			vim.keymap.set("n", "<leader>rn", function()
				return ":IncRename " .. vim.fn.expand("<cword>")
			end, { expr = true })
		end,
	},

	-- {
	-- 	"ray-x/lsp_signature.nvim",
	-- 	event = "VeryLazy",
	-- 	opts = {
	-- 		floating_window = false,
	-- 		hint_enable = false,
	-- 		hint_inline = function()
	-- 			return false
	-- 		end,
	-- 	},
	-- 	config = function(_, opts)
	-- 		-- require("lsp_signature").setup(opts)
	-- 	end,
	-- },
	{ "VidocqH/lsp-lens.nvim", config = true },
}
