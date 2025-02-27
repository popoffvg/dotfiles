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
		build = "make tiktoken",
		config = function()
			local select = require("CopilotChat.select")
			require("CopilotChat").setup({
				debug = false,
				mappings = {
					reset = {
						normal = "<C-r>",
						insert = "<C-r>",
					},
				},
				prompts = {
					["Review unstaged"] = {
						prompt = [[
Review unstaged. Get comment that i should improve.
Wrap the whole message in code block with language gitcommit.
Don"t print code that your are reviewing. print only files names if you write comment.

Carefully check that the method name is passed to the metrics and that no copy-paste errors are made. A copy-paste error occurs when text or a constant repeats words from another place. For those errors add code from changes in git format.
                            ]],
						description = "Review from git diff",
						selection = select.gitdiff,
					},
				},
			})
			-- require("CopilotChat.integrations.cmp").setup()
		end,
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
					md = true,
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
	{
		"olimorris/codecompanion.nvim",
        lazy = false,
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
			"j-hui/fidget.nvim",
		},
		init = function()
			require("configs.fidget-spinner"):init()
            require'codecompanion'.setup()
		end,
		keys = {
			{ "<leader>aa", "<cmd>CodeCompanionActions<CR>", mode = { "n" }, desc = "Code Companion Action" },
			{ "<leader>aa", "<cmd>'<,'>CodeCompanion<CR>", mode = { "v" }, desc = "Inline Code Companion" },
		},
	},
}
