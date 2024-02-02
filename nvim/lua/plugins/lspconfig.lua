local servers = {
	"lua_ls",
	"sqlls",
	"bashls",
	"gopls",
	"yamlls",
	"tsserver",
	"phpactor",
	"pyright",
}

-- LSP settings (for overriding per client)
local handlers = {
	["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, { border = "rounded" }),
	["textDocument/signatureHelp"] = vim.lsp.with(vim.lsp.handlers.signature_help, { border = "rounded" }),
}

local on_attach = function()
	return function(client, bufnr)
		if client.name == "gopls" and not client.server_capabilities.semanticTokensProvider then
			local semantic = client.config.capabilities.textDocument.semanticTokens
			client.server_capabilities.semanticTokensProvider = {
				full = true,
				legend = { tokenModifiers = semantic.tokenModifiers, tokenTypes = semantic.tokenTypes },
				range = true,
			}
		end

		-- client.resolved_capabilities.hover = false
		require("nvim-navic").attach(client, bufnr)

		vim.api.nvim_buf_set_option(bufnr, "omnifunc", "v:lua.vim.lsp.omnifunc")
	end
end

local goimports = function()
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
			local result = vim.lsp.buf_request_sync(0, "textDocument/codeAction", params)
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
			-- Interaction between cmp and lspconfig
			"hrsh7th/cmp-nvim-lsp",
		},
		event = { "BufReadPre", "BufNewFile" },
		config = function()
			local cmp = require("cmp_nvim_lsp")
			local capabilities = cmp.default_capabilities(vim.lsp.protocol.make_client_capabilities())

			vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, { focusable = false })

			require("mason-lspconfig").setup_handlers({
				function(server_name)
					local ok, settings = pcall(require, "plugins.lsp." .. server_name)
					if not ok then
						print("not found settings for " .. server_name)
						return
					end

					require("lspconfig")[server_name].setup({
						capabilities = capabilities,
						on_attach = on_attach(),
						settings = settings,
						handlers = handlers,
					})
				end,
			})
			require("mason-lspconfig").setup({
				ensure_installed = servers,
			})

			goimports()
		end,
		keys = {
			{
				"E",
				function()
					vim.diagnostic.open_float()
				end,
			},
			{ "[d", "<cmd>lua vim.diagnostic.goto_prev()<CR>" },
			{ "]d", "<cmd>lua vim.diagnostic.goto_next()<CR> " },
			{ "<Leader>fe", "<cmd>lua vim.diagnostic.setloclist()<CR>" },
			{ "<C-s>", "<cmd>lua vim.lsp.buf.signature_help()<CR>" },
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
			},
		},
	},
	{
		"mfussenegger/nvim-lint",
		config = function()
			require("lint").linters_by_ft = {
				markdown = { "vale" },
				go = { "golangcilint" },
			}
			vim.api.nvim_create_autocmd({ "BufWinEnter", "BufWritePost" }, {
				callback = function()
					require("lint").try_lint()
				end,
			})
		end,
	},
	{
		"folke/trouble.nvim",
		dependencies = { "nvim-tree/nvim-web-devicons" },
		opts = {
			-- your configuration comes here
			-- or leave it empty to use the default settings
			-- refer to the configuration section below
		},
		keys = {
			{
				"<leader>xw",
				function()
					require("trouble").toggle("workspace_diagnostics")
				end,
				desc = "workspace diagonstics",
			},
			{
				"<leader>xd",
				function()
					require("trouble").toggle("document_diagnostics")
				end,
				desc = "document diagonstics",
			},
		},
	},
}
