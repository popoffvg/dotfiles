return {
	{
		"CopilotC-Nvim/CopilotChat.nvim",
		event = "VeryLazy",
		branch = "canary",
		dependencies = {
			{ "zbirenbaum/copilot.lua" }, -- or github/copilot.vim
			{ "nvim-lua/plenary.nvim" }, -- for curl, log wrapper
			{ "nvim-telescope/telescope.nvim" },
		},
		config = function()
			require("CopilotChat").setup({
				debug = false,
				mappings = {
					reset = {
						normal = "<C-r>",
						insert = "<C-r>",
					},
				},
			})
			require("CopilotChat.integrations.cmp").setup()
		end,
		keys = {
			{
				"<leader>cs",
				function()
					local actions = require("CopilotChat.actions")
					require("CopilotChat.integrations.telescope").pick(actions.prompt_actions())
				end,
				desc = "CopilotChat - Prompt actions",
				mode = { "n", "v" },
			},
			{
				"<leader>cg",
				function()
					local actions = require("CopilotChat.actions")
					require("CopilotChat.integrations.telescope").pick(actions.help_actions())
				end,
				desc = "CopilotChat - Help actions",
				{ mode = { "n", "v" } },
			},
			{
				"<leader>cb",
				function()
					local input = vim.fn.input("Quick Chat: ")
					if input ~= "" then
						require("CopilotChat").ask(input, { selection = require("CopilotChat.select").buffer })
					end
				end,
				desc = "CopilotChat - Quick chat",
			},
			-- Show prompts actions with telescope
		},
		-- See Commands section for default commands if you want to lazy load on them
	},
	{
		"zbirenbaum/copilot.lua",
		cmd = "Copilot",
		event = "BufEnter",
		config = function()
			require("copilot").setup({
				suggestion = {
					enabled = true,
					auto_trigger = true,
					hide_during_completion = true,
					debounce = 75,
					keymap = {
						accept = "<c-s>",
						accept_word = "<c-w>",
						accept_line = false,
						next = "<]]>",
						prev = "<[[>",
						-- dismiss = "<ESC>",
					},
				},
				filetypes = {
					javascript = true, -- allow specific filetype
					typescript = true, -- allow specific filetype
					go = true,
					sql = true,
					yaml = true,
					json = true,
					lua = true,
					-- ["*"] = false, -- disable for all other filetypes and ignore default `filetypes`
					sh = function()
						if string.match(vim.fs.basename(vim.api.nvim_buf_get_name(0)), "^%.env.*") then
							-- disable for .env files
							return false
						end
						return true
					end,
				},
			})
			vim.keymap.set("i", "<ESC>", function()
				if require("copilot.suggestion").is_visible() then
					require("copilot.suggestion").dismiss()
				end
				vim.cmd.stopinsert()
			end, { expr = true })
		end,
	},
	-- {
	-- 	"codota/tabnine-nvim",
	-- 	build = "./dl_binaries.sh",
	-- 	config = function()
	-- 		require("tabnine").setup({
	-- 			disable_auto_comment = false,
	-- 			accept_keymap = "<TAB>",
	-- 			dismiss_keymap = "<C-R>",
	-- 			-- debounce_ms = 800,
	-- 			-- suggestion_color = { gui = "#808080", cterm = 244 },
	-- 			-- codelens_color = { gui = "#808080", cterm = 244 },
	-- 			codelens_enabled = true,
	-- 			-- exclude_filetypes = { "TelescopePrompt", "NvimTree" },
	-- 			-- log_file_path = nil, -- absolute path to Tabnine log file,
	-- 			-- tabnine_enterprise_host = tabnine_enterprise_host,
	-- 			-- ignore_certificate_errors = false,
	-- 		})
	-- 		vim.keymap.set("i", "<tab>", function()
	-- 			if require("tabnine.keymaps").has_suggestion() then
	-- 				return require("tabnine.keymaps").accept_suggestion()
	-- 			elseif require("luasnip").jumpable(1) then
	-- 				return require("luasnip").jump(1)
	-- 			else
	-- 				return "<tab>"
	-- 			end
	-- 		end, { expr = true })
	-- 		-- vim.keymap.set("i", "<TAB>", function()
	-- 		-- 	local cmp = require("cmp")
	-- 		-- 	if cmp.visible() then
	-- 		-- 		return "<TAB>"
	-- 		-- 	end
	-- 		--
	-- 		-- 	if require("tabnine.keymaps").has_suggestion() then
	-- 		-- 		return require("tabnine.keymaps").accept_suggestion()
	-- 		-- 	elseif require("luasnip").jumpable(1) then
	-- 		-- 		return require("luasnip").jump(1)
	-- 		-- 	else
	-- 		-- 		return "<C-F>"
	-- 		-- 	end
	-- 		-- end, { expr = true })
	-- 	end,
	-- },
}
