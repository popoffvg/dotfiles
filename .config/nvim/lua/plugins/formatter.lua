return {
	{
		"stevearc/conform.nvim",
		config = function()
			require("conform").formatters.gogci = {
				inherit = false,
				command = "gci",
				args = {
					"-s",
					"standard",
					"-s",
					"default",
					"-s",
					"prefix(github.com/inDriver)",
					"--custom-order",
					"--skip-generated",
				},
			}
			require("conform").setup({
				formatters_by_ft = {
					proto = { "buf" },
					lua = { "stylua" },
					python = { "isort", "black" },
					javascript = { "prettierd", "prettier" },
					typescript = { "prettierd", "prettier" },
					go = { "mygci", "gofumpt" },
					json = { "jq" },
					html = { "prettier" },
					css = { "prettier" },
					scss = { "prettier" },
					markdown = { "prettier" },
					vue = { "prettier" },
					yaml = { "prettier" },
				},
				format_on_save = {
					timeout_ms = 500,
					lsp_fllback = true,
				},
			})
			-- require("conform").formatters.sql_formatter = {
			-- 	prepend_args = { "-c", vim.fn.expand("~/.config/sql_formatter.json") },
			-- }
		end,
	},
}
