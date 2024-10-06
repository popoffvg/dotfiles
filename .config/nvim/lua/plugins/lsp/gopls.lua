local goflags = os.getenv("GOFLAGS")

return {
	gopls = {
		semanticTokens = true,
		hints = {
			rangeVariableTypes = false,
			parameterNames = true,
			constantValues = true,
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
			generate = false, -- show the `go generate` lens.
			-- gc_details = false, --  // Show a code lens toggling the display of gc's choices.
			test = false,
			tidy = false,
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
