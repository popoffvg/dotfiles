local function run_curr_python_file()
	-- Get file name in the current buffer
	local file_name = vim.api.nvim_buf_get_name(0)
	print(file_name)

	-- Get terminal codes for running python file
	-- ("i" to enter insert before typing rest of the command)
	local py_cmd = vim.api.nvim_replace_termcodes('ipython3 "' .. file_name .. '"<cr>', true, false, true)

	-- Determine terminal window split and launch terminal
	local percent_of_win = 0.4
	local curr_win_height = vim.api.nvim_win_get_height(0) -- Current window height
	local term_height = math.floor(curr_win_height * percent_of_win) -- Terminal height
	vim.cmd(":below " .. term_height .. "split | term") -- Launch terminal (horizontal split)

	-- Press keys to run python command on current file
	vim.api.nvim_feedkeys(py_cmd, "t", false)
end

vim.keymap.set({ "n" }, "<leader><leader>r", "RunCurrent", {
	desc = "Run .py file via Neovim built-in terminal",
	callback = run_curr_python_file,
})

vim.api.nvim_create_user_command("RunCurrent", function()
	run_curr_python_file()
end, { nargs = 0, desc = "Run .py file via Neovim built-in terminal" })
