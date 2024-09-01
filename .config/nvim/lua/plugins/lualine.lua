local function get_attached_clients()
	local buf_clients = vim.lsp.get_active_clients({ bufnr = 0 })
	if #buf_clients == 0 then
		return "LSP Inactive"
	end

	local buf_ft = vim.bo.filetype
	local buf_client_names = {}

	-- add client
	for _, client in pairs(buf_clients) do
		if client.name ~= "copilot" and client.name ~= "null-ls" and client.name ~= "tabnine" then
			table.insert(buf_client_names, client.name)
		end
	end

	-- Generally, you should use either null-ls or nvim-lint + formatter.nvim, not both.

	-- Add sources (from null-ls)
	-- null-ls registers each source as a separate attached client, so we need to filter for unique names down below.
	local null_ls_s, null_ls = pcall(require, "null-ls")
	if null_ls_s then
		local sources = null_ls.get_sources()
		for _, source in ipairs(sources) do
			if source._validated then
				for ft_name, ft_active in pairs(source.filetypes) do
					if ft_name == buf_ft and ft_active then
						table.insert(buf_client_names, source.name)
					end
				end
			end
		end
	end

	-- Add linters (from nvim-lint)
	local lint_s, lint = pcall(require, "lint")
	if lint_s then
		for ft_k, ft_v in pairs(lint.linters_by_ft) do
			if type(ft_v) == "table" then
				for _, linter in ipairs(ft_v) do
					if buf_ft == ft_k then
						table.insert(buf_client_names, linter)
					end
				end
			elseif type(ft_v) == "string" then
				if buf_ft == ft_k then
					table.insert(buf_client_names, ft_v)
				end
			end
		end
	end

	-- Add formatters (from formatter.nvim)
	local formatter_s, _ = pcall(require, "formatter")
	if formatter_s then
		local formatter_util = require("formatter.util")
		for _, formatter in ipairs(formatter_util.get_available_formatters_for_ft(buf_ft)) do
			if formatter then
				table.insert(buf_client_names, formatter)
			end
		end
	end

	-- This needs to be a string only table so we can use concat below
	local unique_client_names = {}
	for _, client_name_target in ipairs(buf_client_names) do
		local is_duplicate = false
		for _, client_name_compare in ipairs(unique_client_names) do
			if client_name_target == client_name_compare then
				is_duplicate = true
			end
		end
		if not is_duplicate then
			table.insert(unique_client_names, client_name_target)
		end
	end

	local client_names_str = table.concat(unique_client_names, ", ")
	local language_servers = string.format("[%s]", client_names_str)

	return language_servers
end

return {
	"nvim-lualine/lualine.nvim",
	lazy = false,
	dependencies = {
		"SmiteshP/nvim-navic",
		"Mofiqul/vscode.nvim",
		"nvim-tree/nvim-web-devicons",
		"AndreM222/copilot-lualine",
	},
	config = function()
		local navic = require("nvim-navic")
		require("lualine").setup({
			options = {
				component_separators = { left = "", right = "" },
				section_separators = { left = "", right = "" },
				globalstatus = true,
				theme = "cyberdream",
			},
			tabline = {
				lualine_a = {
					{
						function()
							return vim.fn.fnamemoify(vim.fn.expand("%:h:t"), ":p:~:.")
						end,
					},
				},
				lualine_b = {
					{ "%=" },
					-- {
					-- 	function()
					-- 		return vim.fn.fnamemoify(vim.fn.expand("%:h:t"), ":p:~:.")
					-- 	end,
					-- },
					-- {
					-- 	"filename",
					-- 	path = 0,
					-- 	-- 	-- mode = 2, -- index + name
					-- },

					-- { "diagnostics" },
				},
				lualine_c = {
					{
						function()
							local size = 4
							local loc = navic.get_location()
							local parts = vim.split(loc, ">")

							if #parts <= size then
								return loc
							end

							local newloc = parts[1]
							for i = 2, size, 1 do
								newloc = newloc .. ">" .. parts[i]
							end

							return newloc
						end,
						-- https://github.com/nvim-lualine/lualine.nvim/wiki/Writing-a-theme
						-- for lualine_z theme will be as lualine_a with mode changing
						-- color = { bg = c.TabLine, fg = c.Normal, gui = "none" },
					},
				},
				-- lualine_y = {
				-- 	"diagnostics",
				-- },
				-- lualine_a = {
				-- 	{
				-- 		"buffers",
				-- 		hide_filename_extension = true,
				-- 		-- mode = 2, -- index + name
				-- 	},
				-- },
				lualine_z = {
					-- { "tabnine", "encoding", "fileformat", "filetype" },
					{ "copilot" },
				},
			},
			sections = {
				lualine_a = {
					{
						"mode",
						path = 1,
					},
				},
				lualine_b = {
					{
						function()
							local reg = vim.fn.reg_recording()
							if reg == "" then
								return ""
							end -- not recording
							return "R" .. reg
						end,
					},
				},

				lualine_c = {
					{ "%=" },
					{

						"filename",
						path = 1,
						-- mode = 2, -- index + name
					},
					{ "diagnostics" },
				},
				lualine_x = {
					{ "branch" },
				},
				lualine_z = {},

				-- lualine_z = { get_attached_clients, "filetype" },
			},
		})
	end,
}
