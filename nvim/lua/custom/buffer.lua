local ok, bufline = pcall(require, "bufferline")

if not status then
  print("ERROR bufferline")
  return
end

bufline.setup({
	options = {
		diagnostics = "nvim_lsp",
        show_tab_indicators = true,
	},
})
