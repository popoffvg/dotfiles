local function build()
	local result = {}
	table.insert(result, require("plugins.languages.go"))
	return result
end

return build()
