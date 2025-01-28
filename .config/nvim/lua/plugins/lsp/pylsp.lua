return {
	-- cmd = vim.lsp.rpc.connect("127.0.0.1", 9977),
	settings = {
		pylsp = {
			plugins = {
				-- These functionalities are handled by ruff:
				pyflakes = { enabled = false },
				pycodestyle = { enabled = false },
				-- I use black for formatting:
				yapf = { enabled = false },
				autopep8 = { enabled = false },
				-- NOTE: Requires `py3-lsp-black`.
				black = { enabled = true },
				mypy = { enabled = true },
				rope_autoimport = {
					enabled = true,
					completion = true,
					code_actions = true,
				},
				-- +          rope_autoimport = {enabled = true},
			},
		},
	},
}
