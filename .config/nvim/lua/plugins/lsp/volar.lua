local M = {}
function M.setup(capabilities, handlers, on_attach)
	require("lspconfig").volar.setup({
		on_attach = on_attach(),
		filetypes = { "typescript", "javascript", "javascriptreact", "typescriptreact", "vue" },
		settings = {
			init_options = {
				vue = {
					hybridMode = true,
				},
			},
		},
		handlers = handlers,
		capabilities = capabilities,
	})
end

return M
