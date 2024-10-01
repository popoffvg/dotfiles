local function collect_dirs(projects, root)
	local dirs = vim.fn.globpath(root, "*", 1, 1)
	if projects == nil then
		projects = {}
	end
	for _, dir in ipairs(dirs) do
		if vim.fn.isdirectory(dir .. "/.git") ~= 0 then
			table.insert(projects, dir)
			goto continue
		end

		collect_dirs(projects, dir)
		::continue::
	end
	return projects
end

local function env_or_default(env, default)
	local value = os.getenv(env)
	if value == nil then
		return default
	end
	return value
end

return {
	{
		"coffebar/neovim-project",
		opts = {
			projects = collect_dirs(nil, env_or_default("PROJECTS_ROOT", vim.fn.expand("%:p:h"))),
			picker = {
				type = "telescope", -- or "fzf-lua"
			},
			dashboard_mode = true,
			last_session_on_startup = true,
		},
		init = function()
			-- enable saving the state of plugins in the session
			vim.opt.sessionoptions:append("globals") -- save global variables that start with an uppercase letter and contain at least one lowercase letter.
		end,
		dependencies = {
			{ "nvim-lua/plenary.nvim" },
			-- optional picker
			{ "nvim-telescope/telescope.nvim", tag = "0.1.4" },
			-- optional picker
			{ "ibhagwan/fzf-lua" },
			{ "Shatur/neovim-session-manager" },
		},
		lazy = false,
		priority = 100,
		keys = {
			{ "<leader>fp", "<cmd>NeovimProjectDiscover<CR>", noremap = true, silent = true },
		},
	},
}
