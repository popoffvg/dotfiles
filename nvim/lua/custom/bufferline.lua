
local ok, bufline = pcall(require, "bufferline")

bufline.setup({
	options = {
		diagnostics = "nvim_lsp",
        show_tab_indicators = true,   
        left_mouse_command = "buffer %d",
               offsets = {
            {
                filetype = "NvimTree",
                text = "File Explorer",
                highlight = "Directory",
                separator = true -- use a "true" to enable the default, or set your own character
            }
        },
	},
})

vim.cmd[[
nnoremap <silent> <Leader><Tab> :BufferLinePick<CR>
]]
