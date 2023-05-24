local opts = { noremap=true, silent=true }

vim.api.nvim_set_keymap('n', '<space>e', '<cmd>lua vim.diagnostic.open_float()<CR>', opts)
vim.api.nvim_set_keymap('n', '[d', '<cmd>lua vim.diagnostic.goto_prev()<CR>', opts)
vim.api.nvim_set_keymap('n', ']d', '<cmd>lua vim.diagnostic.goto_next()<CR>', opts)
vim.api.nvim_set_keymap('n', '<space>q', '<cmd>lua vim.diagnostic.setloclist()<CR>', opts)

local on_attach = function(client, bufnr)
	local function buf_set_keymap(...)
		vim.api.nvim_buf_set_keymap(bufnr, ...)
	end
	-- Enable completion triggered by <c-x><c-o>
	vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.vim.lsp.omnifunc')

	-- Mappings.
	-- buf_set_keymap("n", "<Leader>D", "<cmd>lua vim.lsp.buf.declaration()<CR>", opts)
	buf_set_keymap("n", "gd", "<cmd>Telescope lsp_definitions<CR>", opts)
	-- buf_set_keymap("n", "K", "<cmd>lua vim.lsp.buf.hover()<CR>", opts)
	buf_set_keymap("n", "gi", "<cmd>Telescope lsp_implementations<CR>", opts)
	buf_set_keymap("n", "<C-k>", "<cmd>lua vim.lsp.buf.signature_help()<CR>", opts)
	-- buf_set_keymap("n", "gD", "<cmd>Telescope lsp_type_definitions<CR>", opts)
	buf_set_keymap("n", "<leader>rn", "<cmd>lua vim.lsp.buf.rename()<CR>", opts)
	buf_set_keymap("n", "<leader>ca", "<cmd>lua vim.lsp.buf.code_action()<CR>", opts)
	buf_set_keymap("n", "gr", "<cmd>Telescope lsp_references<CR>", opts)

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
local capabilities = require('cmp_nvim_lsp').default_capabilities(vim.lsp.protocol.make_client_capabilities())

-- GOPLS {{{
local lspconfig = require("lspconfig")
local configs = require("lspconfig.configs")

local goflags = os.getenv("GOFLAGS")
require'lspconfig'.gopls.setup{
    cmd = { "gopls" },
	on_attach = on_attach,
	capabilities = capabilities,
	settings = {
		gopls = {
			experimentalPostfixCompletions = true,
			analyses = {
				unusedparams = true,
				shadow = true,
			},
			staticcheck = true,
            buildFlags = {goflags},
		},
	},
	init_options = {
		usePlaceholders = true,
	},
}

if not configs.golangcilsp then
	configs.golangcilsp = {
		default_config = {
			cmd = { "golangci-lint-langserver" },
			root_dir = lspconfig.util.root_pattern(".git", "go.mod"),
			init_options = {
				-- command = { "golangci-lint", "run", "--enable-all", "--out-format", "json" };
				command = { "golangci-lint", "run", "--out-format", "json" },
			},
		},
	}
end
lspconfig.golangcilsp.setup({
	filetypes = { "go" },
})

require('lspconfig')['pyright'].setup {
	capabilities = capabilities,
	on_attach = on_attach
}
require('lspconfig')['bashls'].setup {
	capabilities = capabilities,
	on_attach = on_attach
}
require('lspconfig')['sqlls'].setup {
	capabilities = capabilities,
	on_attach = on_attach
}
require('lspconfig')['lua_ls'].setup = {
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
        version = 'LuaJIT',
      },
      diagnostics = {
        -- Get the language server to recognize the `vim` global
        globals = {'vim'},
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
}

require('lspconfig')['yamlls'].setup {
  on_attach = on_attach,
  capabilities = capabilities,
  settings = {
    yaml = {
      schemas = {
        ["https://github.com/OAI/OpenAPI-Specification/blob/main/schemas/v2.0/schema.json"] = "/*"
      }
    }
  }
}

vim.api.nvim_set_var("go_def_mode", "gopls")
vim.api.nvim_set_var("go_info_mode", "gopls")


require'lspconfig'.phpactor.setup{
    on_attach = on_attach,
    init_options = {
        ["language_server_phpstan.enabled"] = false,
        ["language_server_psalm.enabled"] = false,
    }
}
