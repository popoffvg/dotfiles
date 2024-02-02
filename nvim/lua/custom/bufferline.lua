local ok, bufline = pcall(require, "bufferline")

bufline.setup({
	options = {
		section_separators = { left = "", right = "" },
		-- separator_style = { "", "" },
		show_buffer_icons = false,
		separator_style = "thick",
		indicator = {
			icon = "", -- this should be omitted if indicator style is not 'icon'
			style = "underline",
		},
		diagnostics = "nvim_lsp",
		show_tab_indicators = true,
		left_mouse_command = "buffer %d",
		offsets = {
			{
				filetype = "NvimTree",
				text = "File Explorer",
				highlight = "Directory",
				separator = true, -- use a "true" to enable the default, or set your own character
			},
		},
	},
})

vim.cmd([[
nnoremap <silent> <Leader><Tab> :BufferLinePick<CR>
]])
