vim.cmd([[
augroup autoformat_settings
  " autocmd FileType bzl AutoFormatBuffer buildifier
  " autocmd FileType c,cpp,proto,javascript,arduino AutoFormatBuffer clang-format
  autocmd FileType dart AutoFormatBuffer dartfmt
  " autocmd FileType go AutoFormatBuffer gofumt
  " autocmd FileType gn AutoFormatBuffer gn
  autocmd FileType html,css,sass,scss,less,json AutoFormatBuffer js-beautify
  " autocmd FileType java AutoFormatBuffer google-java-format
  " autocmd FileType python AutoFormatBuffer yapf
  " Alternative: autocmd FileType python AutoFormatBuffer autopep8
  " autocmd FileType rust AutoFormatBuffer rustfmt
  " autocmd FileType vue AutoFormatBuffer prettier
  " autocmd FileType swift AutoFormatBuffer swift-format
augroup END
]])

-- Examples: https://github.com/mhartington/formatter.nvim/blob/master/CONFIG.md
-- Prettier function for formatter
-- npm install -g prettier
local function prettier()
	return {
		exe = "prettier",
		args = { "--stdin-filepath", vim.fn.fnameescape(vim.api.nvim_buf_get_name(0)) },
		stdin = true,
	}
end

local function clangd()
	return {
		exe = "clang-format",
		args = { "--assume-filename", vim.api.nvim_buf_get_name(0) },
		stdin = true,
		cwd = vim.fn.expand("%:p:h"), -- Run clang-format in cwd of the file.
	}
end

-- pip install black
local function black()
	return { exe = "black", args = { "--quiet", "-" }, stdin = true }
end

-- pip install isort
local function isort()
	return { exe = "isort", args = { "--quiet", "-" }, stdin = true }
end

local function golines()
	return { exe = "golines", args = { "--max-len=80" }, stdin = true }
end

local function gofmt()
	return { exe = "gofumpt", args = { "-s" }, stdin = true }
end

local function gogci()
	return { exe = "gci", args = { "print", "--skip-generated", "-s default" }, stdin = true }
end

local function rustfmt()
	return { exe = "rustfmt", args = { "--emit=stdout", "--edition 2021" }, stdin = true }
end

-- go install github.com/google/yamlfmt/cmd/yamlfmt@latest
local function yamlfmt()
	return { exe = "yamlfmt", args = { "-in" }, stdin = true }
end

-- brew install ghcup
-- stack install stylish-haskell
local function stylish_haskell()
	return { exe = "stylish-haskell", stdin = true }
end

local function ocamlformat()
	return { exe = "ocamlformat", stdin = true }
end

local util = require("formatter.util")

require("formatter").setup({
	logging = false,
	filetype = {
		typescriptreact = { prettier },
		javacriptreact = { prettier },
		javascript = { prettier },
		typescript = { prettier },
		svelte = { prettier },
		json = { prettier },
		html = { prettier },
		css = { prettier },
		scss = { prettier },
		markdown = { prettier },
		vue = { prettier },
		yaml = { yamlfmt },
		-- htmldjango = {prettier},
		lua = {
			-- "formatter.filetypes.lua" defines default configurations for the
			-- "lua" filetype
			require("formatter.filetypes.lua").stylua,

			-- You can also define your own configuration
			function()
				-- supports conditional formatting
				if util.get_current_buffer_file_name() == "special.lua" then
					return nil
				end

				-- full specification of configurations is down below and in vim help
				-- files
				return {
					exe = "stylua",
					args = {
						"--search-parent-directories",
						"--stdin-filepath",
						util.escape_path(util.get_current_buffer_file_path()),
						"--",
						"-",
					},
					stdin = true,
				}
			end,
		},
		cpp = { clangd },
		c = { clangd },
		rust = { rustfmt },
		python = { black, isort },
		go = { gofmt, gogci, golines, gofumpt },
		perl = {
			-- perltidy
			function()
				return {
					exe = "perltidy",
					args = { "--standard-output" },
					stdin = true,
				}
			end,
		},
		haskell = { stylish_haskell },
		ocaml = { ocamlformat },
	},
})

-- Runs Prettier on save
vim.api.nvim_exec(
	[[
augroup FormatAutogroup
  autocmd!
  autocmd BufWritePost *.js,*.ts,*.tsx,*.css,*.scss,*.md,*.lua,.*json,*.vue : FormatWrite
augroup END
]],
	true
)
