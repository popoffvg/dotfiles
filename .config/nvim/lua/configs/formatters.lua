local M = {}

function M.prettier()
	return {
		exe = "prettier",
		args = { "--stdin-filepath", vim.fn.fnameescape(vim.api.nvim_buf_get_name(0)) },
		stdin = true,
	}
end

function M.clangd()
	return {
		exe = "clang-format",
		args = { "--assume-filename", vim.api.nvim_buf_get_name(0) },
		stdin = true,
		cwd = vim.fn.expand("%:p:h"), -- Run clang-format in cwd of the file.
	}
end

-- pip install black
function M.black()
	return { exe = "black", args = { "--quiet", "-" }, stdin = true }
end

-- pip install isort
function M.isort()
	return { exe = "isort", args = { "--quiet", "-" }, stdin = true }
end

function M.golines()
	return { exe = "golines", args = { "--max-len=80" }, stdin = true }
end

function M.gofumt()
	return {
		exe = "gofumpt",
		stdin = true,
	}
end

function M.goimports()
	return {
		exe = "goimports",
		stdin = true,
	}
end

function M.gogci()
	return {
		exe = "gci",
		-- args = {
		-- 	"-s standard",
		-- 	"-s default",
		-- 	"-s prefix(github.com/inDriver)",
		-- 	"--custom-order",
		-- 	"--skip-generated",
		-- 	"--skip-vendor",
		-- },
		stdin = true,
	}
end

function M.rustfmt()
	return { exe = "rustfmt", args = { "--emit=stdout", "--edition 2021" }, stdin = true }
end

-- go install github.com/google/yamlfmt/cmd/yamlfmt@latest
function M.yamlfmt()
	return { exe = "yamlfmt", args = { "-in" }, stdin = true }
end

-- brew install ghcup
-- stack install stylish-haskell
function M.stylish_haskell()
	return { exe = "stylish-haskell", stdin = true }
end

function M.ocamlformat()
	return { exe = "ocamlformat", stdin = true }
end

function M.lua()
	local util = require("formatter.util")
	-- You can also define your own configuration
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
end

function M.perltidy()
	return {
		exe = "perltidy",
		args = { "--standard-output" },
		stdin = true,
	}
end

return M
