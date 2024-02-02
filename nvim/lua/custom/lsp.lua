local opts = { noremap = true, silent = true }

vim.api.nvim_set_keymap("n", "<space>e", "<cmd>lua vim.diagnostic.open_float()<CR>", opts)
vim.api.nvim_set_keymap("n", "[d", "<cmd>lua vim.diagnostic.goto_prev()<CR>", opts)
vim.api.nvim_set_keymap("n", "]d", "<cmd>lua vim.diagnostic.goto_next()<CR>", opts)
vim.api.nvim_set_keymap("n", "<space>q", "<cmd>lua vim.diagnostic.setloclist()<CR>", opts)

vim.api.nvim_set_keymap("n", "gd", "<cmd>Telescope lsp_definitions<CR>", opts)
-- vim.api.nvim_set_keymap("n", "K", "<cmd>lua vim.lsp.buf.hover()<CR>", opts)
vim.api.nvim_set_keymap("n", "gi", "<cmd>Telescope lsp_implementations<CR>", opts)
vim.api.nvim_set_keymap("n", "<C-s>", "<cmd>lua vim.lsp.buf.signature_help()<CR>", opts)
-- vim.api.nvim_set_keymap("n", "gD", "<cmd>Telescope lsp_type_definitions<CR>", opts)
vim.api.nvim_set_keymap("n", "<leader>rn", "<cmd>lua vim.lsp.buf.rename()<CR>", opts)
vim.api.nvim_set_keymap("n", "<leader>ca", "<cmd>lua vim.lsp.buf.code_action()<CR>", opts)
vim.api.nvim_set_keymap("n", "gr", "<cmd>Telescope lsp_references<CR>", opts)

-- local navic = require("nvim-navic")
local on_attach = function(client, bufnr)
	local navic = require("nvim-navic")

	client.resolved_capabilities.hover = false
	if client.server_capabilities.documentSymbolProvider then
		navic.attach(client, bufnr)
	end

	local function buf_set_keymap(...)
		vim.api.nvim_set_keymap(bufnr, ...)
	end
	-- Enable completion triggered by <c-x><c-o>
	vim.api.nvim_buf_set_option(bufnr, "omnifunc", "v:lua.vim.lsp.omnifunc")

	-- Mappings.
	-- buf_set_keymap("n", "<Leader>D", "<cmd>lua vim.lsp.buf.declaration()<CR>", opts)

	-- buf_set_keymap("n", "gr", [[<cmd>lua require("telescope.builtin").lsp_references(require('telescope.themes').get_dropdown({}))<CR>]], opts)
	-- if client.resolved_capabilities.document_formatting then
	-- 	vim.cmd([[
	-- 		augroup formatting
	-- 			autocmd! * <buffer>
	-- 			autocmd BufWritePre <buffer> lua vim.lsp.buf.formatting_seq_sync()
	-- 		augroup END
	-- 	]])
	-- end
end

-- Setup lspconfig.
local capabilities = require("cmp_nvim_lsp").default_capabilities(vim.lsp.protocol.make_client_capabilities())

vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, { focusable = false })

local goflags = os.getenv("GOFLAGS")
require("lspconfig").gopls.setup({
	cmd = { "gopls" },
	on_attach = on_attach,
	capabilities = capabilities,
	settings = {
		gopls = {
			["ui.inlayhint.hints"] = {
				compositeLiteralFields = true,
				constantValues = true,
				parameterNames = true,
			},
			experimentalPostfixCompletions = true,
			analyses = {
				unusedparams = true,
				shadow = true,
			},
			codelenses = {
				generate = true, -- show the `go generate` lens.
				-- gc_details = true, --  // Show a code lens toggling the display of gc's choices.
				test = true,
				tidy = true,
			},
			usePlaceholders = true,
			completeUnimported = true,
			staticcheck = true,
			matcher = "fuzzy",
			diagnosticsDelay = "500ms",
			-- experimentalWatchedFileDelay = "100ms",
			symbolMatcher = "fuzzy",
			buildFlags = { goflags },
		},
	},
	init_options = {
		usePlaceholders = true,
	},
})

local lspconfig = require("lspconfig")
local configs = require("lspconfig/configs")

if not configs.golangcilsp then
	configs.golangcilsp = {
		on_attach = on_attach,
		default_config = {
			cmd = { "golangci-lint-langserver -debug" },
			root_dir = lspconfig.util.root_pattern(".git", "go.mod"),
			init_options = {
				command = { "golangci-lint", "run", "--out-format", "json" },
			},
		},
	}
end
lspconfig.golangci_lint_ls.setup({
	on_attach = on_attach,
	filetypes = { "go", "gomod" },
})

require("lint").linters_by_ft = {
	markdown = { "vale" },
	gp = { "golangcilint" },
}

vim.api.nvim_set_var("go_def_mode", "gopls")
vim.api.nvim_set_var("go_info_mode", "gopls")

require("lspconfig")["pyright"].setup({
	capabilities = capabilities,
	on_attach = on_attach,
})
require("lspconfig")["bashls"].setup({
	capabilities = capabilities,
	on_attach = on_attach,
})
require("lspconfig")["sqlls"].setup({
	capabilities = capabilities,
	on_attach = on_attach,
})

require("lspconfig").lua_ls.setup({
	capabilities = capabilities,
	on_attach = on_attach,
	-- fixes for lsp-status so it shows the function in its status bar
	select_symbol = function(cursor_pos, symbol)
		if symbol.valueRange then
			local value_range = {
				["start"] = {
					character = 0,
					line = vim.fn.byte2line(symbol.valueRange[1]),
				},
				["end"] = {
					character = 0,
					line = vim.fn.byte2line(symbol.valueRange[2]),
				},
			}
			return require("lsp-status.util").in_range(cursor_pos, value_range)
		end
	end,
	settings = {
		Lua = {
			runtime = {
				-- Tell the language server which version of Lua you're using (most likely LuaJIT in the case of Neovim)
				version = "LuaJIT",
			},
			diagnostics = {
				-- Get the language server to recognize the `vim` global
				globals = { "vim" },
			},
			workspace = {
				-- Make the server aware of Neovim runtime files
				library = vim.api.nvim_get_runtime_file("", true),
			},
			-- Do not send telemetry data containing a randomized but unique identifier
			telemetry = {
				enable = false,
			},
		},
	},
})

require("lspconfig")["yamlls"].setup({
	on_attach = on_attach,
	capabilities = capabilities,
	settings = {
		yaml = {
			schemas = {
				["https://github.com/OAI/OpenAPI-Specification/blob/main/schemas/v2.0/schema.json"] = "/*",
			},
		},
	},
})

require("lspconfig").tsserver.setup({
	on_attach = on_attach,
	filetypes = { "typescript", "typescriptreact", "typescript.tsx" },
	cmd = { "typescript-language-server", "--stdio" },
	-- capabilities = require('cmp_nvim_lsp').update_capabilities(vim.lsp.protocol.make_client_capabilities),
})

require("lspconfig").phpactor.setup({
	on_attach = on_attach,
	init_options = {
		["language_server_phpstan.enabled"] = false,
		["language_server_psalm.enabled"] = false,
	},
})

vim.keymap.set("n", "[c", function()
	require("treesitter-context").go_to_context(vim.v.count1)
end, { silent = true })
vim.cmd([[
    hi TreesitterContextBottom gui=underline guisp=Grey
]])
