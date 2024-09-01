local goflags = os.getenv("GOFLAGS")

return {
	gopls = {
		semanticTokens = true,
		hints = {
			rangeVariableTypes = false,
			parameterNames = true,
			constantValues = false,
			assignVariableTypes = false,
			compositeLiteralFields = false,
			compositeLiteralTypes = false,
			functionTypeParameters = false,
		},
		experimentalPostfixCompletions = true,
		analyses = {
			unusedparams = true,
			shadow = true,
		},
		gofumpt = true,
		codelenses = {
			generate = true, -- show the `go generate` lens.
			-- gc_details = true, --  // Show a code lens toggling the display of gc's choices.
			test = true,
			tidy = true,
		},

		usePlaceholders = false,
		completeUnimported = true,
		staticcheck = true,
		matcher = "fuzzy",
		diagnosticsDelay = "500ms",
		-- experimentalWatchedFileDelay = "100ms",
		symbolMatcher = "fuzzy",
		buildFlags = { goflags },
	},
}
