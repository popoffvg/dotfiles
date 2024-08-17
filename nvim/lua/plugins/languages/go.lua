Routes = {
	{
		view = "split",
		filter = { find = "go test" },
	},
}

return {
	"meain/vim-jsontogo",
	{
		"ray-x/go.nvim",
		dependencies = {
			"ray-x/guihua.lua",
		},
		config = function()
			require("go").setup({
				icons = {
					code_action_icon = "💡",
				},
				lsp_codelens = false,
				lsp_inlay_hints = {
					enable = false,
					other_hints_prefix = "=> ",
					parameter_hints_prefix = "#",
				},
				lsp_on_client_start = function(client, bufnr)
					require("config.keymap").go_on_attach(client, bufnr)
					require("lsp_signature").on_attach()
					vim.lsp.codelens.refresh()
				end,
			})
			local format_sync_grp = vim.api.nvim_create_augroup("GoImport", {})
			vim.api.nvim_create_autocmd("BufWritePre", {
				pattern = "*.go",
				callback = function()
					require("go.format").gofmt()
					require("go.format").goimport()
				end,
				group = format_sync_grp,
			})
		end,
	},
	{
		"leoluz/nvim-dap-go",
		dependencies = {
			"williamboman/mason.nvim",
			"jay-babu/mason-nvim-dap.nvim",
			"mfussenegger/nvim-dap",
			"rcarriga/nvim-dap-ui",
			"nvim-neotest/nvim-nio",
		},
		config = function()
			require("mason-nvim-dap").setup({
				ensure_installed = { "delve" },
			})
			require("dap-go").setup({
				dap_configurations = {
					{
						type = "go",
						name = "Attach remote",
						mode = "remote",
						request = "attach",
					},
				},
				-- delve configurations
				delve = {
					-- the path to the executable dlv which will be used for debugging.
					-- by default, this is the "dlv" executable on your PATH.
					path = "dlv",
					-- time to wait for delve to initialize the debug session.
					-- default to 20 seconds
					initialize_timeout_sec = 20,
					-- a string that defines the port to start delve debugger.
					-- default to string "${port}" which instructs nvim-dap
					-- to start the process in a random available port
					port = "2345",
					-- additional args to pass to dlv
					args = {},
				},
			})
			require("dapui").setup()

			vim.api.nvim_set_hl(0, "DapBreakpoint", { ctermbg = 0, fg = "#993939", bg = "#31353f" })
			vim.api.nvim_set_hl(0, "DapLogPoint", { ctermbg = 0, fg = "#61afef", bg = "#31353f" })
			vim.api.nvim_set_hl(0, "DapStopped", { ctermbg = 0, fg = "#98c379", bg = "#31353f" })

			vim.fn.sign_define(
				"DapBreakpoint",
				{ text = "🔴", texthl = "DapBreakpoint", linehl = "DapBreakpoint", numhl = "DapBreakpoint" }
			)
			vim.fn.sign_define(
				"DapBreakpointCondition",
				{ text = "ﳁ", texthl = "DapBreakpoint", linehl = "DapBreakpoint", numhl = "DapBreakpoint" }
			)
			vim.fn.sign_define(
				"DapBreakpointRejected",
				{ text = "", texthl = "DapBreakpoint", linehl = "DapBreakpoint", numhl = "DapBreakpoint" }
			)
			vim.fn.sign_define(
				"DapLogPoint",
				{ text = "", texthl = "DapLogPoint", linehl = "DapLogPoint", numhl = "DapLogPoint" }
			)
			vim.fn.sign_define(
				"DapStopped",
				{ text = "", texthl = "DapStopped", linehl = "DapStopped", numhl = "DapStopped" }
			)
		end,
		keys = {
			{
				"<m-5>",
				function()
					require("dap").continue()
				end,
			},
			{
				"<m-9>",
				function()
					require("dap").toggle_breakpoint()
				end,
			},
			{
				"<m-6>", -- F10
				function()
					require("dap").step_over()
				end,
			},
			{
				"<m-7>", -- F11
				function()
					require("dap").step_into()
				end,
			},
			{
				"<m-8>", -- F12
				function()
					require("dap").step_out()
				end,
			},
			{
				"<leader>dd",
				function()
					require("dap").toggle()
				end,
			},
		},
	},
	{
		"popoffvg/goimpl.nvim",
		dependecies = {
			"nvim-telescope/telescope.nvim",
		},
		config = function()
			require("telescope").load_extension("goimpl")
		end,
		keys = {
			{
				"<leader>ci",
				"<cmd>lua require'telescope'.extensions.goimpl.goimpl{}<CR>]",
				"implement interface",
				noremap = true,
				silent = true,
			},
		},
	},
}
