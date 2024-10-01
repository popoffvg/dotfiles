local function change_new_val()
	local current_line = vim.api.nvim_get_current_line()
	local row, col = unpack(vim.api.nvim_win_get_cursor(0))

	local new_line = ""
	if current_line:find(":=") then
		new_line = string.gsub(current_line, ":=", "=", 1)
	elseif current_line:find("=") then
		new_line = string.gsub(current_line, "=", ":=", 1)
	else
		new_line = current_line .. ":="
	end

	vim.api.nvim_buf_set_lines(0, row - 1, row, true, { new_line })
end
vim.keymap.set("n", "<c-=>", change_new_val, { noremap = true })
vim.keymap.set("n", "<leader>=", change_new_val, { noremap = true })
