local mason_registry = require("mason-registry")
local vue_language_server_path = mason_registry.get_package("vue-language-server"):get_install_path()
	.. "/node_modules/@vue/language-server"

local M = {}
function M.setup(capabilities, handlers, on_attach)
	require("lspconfig").tsserver.setup({
		on_attach = on_attach(),
		init_options = {
			preferences = {
				includeCompletionsForModuleExports = true,
				includeCompletionsForImportStatements = true,
				importModuleSpecifierPreference = "relative",
			},
			plugins = {
				{
					name = "@vue/typescript-plugin",
					location = vue_language_server_path,
					languages = { "vue" },
				},
			},
		},
		filetypes = {
			"typescript",
			"javascript",
			"javascriptreact",
			"typescriptreact",
			"vue",
		},
		settings = {},
		handlers = handlers,
		capabilities = capabilities,
	})
end

return M
