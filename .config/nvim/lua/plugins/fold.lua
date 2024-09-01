local handler = function(virtText, lnum, endLnum, width, truncate)
	local line = vim.fn.getline(lnum)
	if line:find("if%s+err%s*!= nil") then
		local prevLine = vim.api.nvim_buf_get_lines(0, lnum - 2, lnum - 1, false)[1]
		local indent = string.match(prevLine, "^%s*") or ""
		local startLine = lnum
		local endLine = endLnum
		local lines = vim.api.nvim_buf_get_lines(0, startLine, endLine - 1, false)
		for i, l in ipairs(lines) do
			lines[i] = l:gsub("^%s*", ""):gsub("return", "..")
		end
		local newText = indent .. table.concat(lines, "; ")
		virtText = { { newText, "@comment" } }
		return virtText
	end
	if line:find("if%s+[^;]+;[^;]+!= nil") then
		-- local startLine = lnum
		-- local endLine = endLnum
		-- local content = table.concat(vim.api.nvim_buf_get_lines(0, startLine, endLine - 1, false), "")
		local startLine = lnum
		local endLine = endLnum
		local lines = vim.api.nvim_buf_get_lines(0, startLine, endLine - 1, false)
		for i, l in ipairs(lines) do
			lines[i] = l:gsub("^%s*", "")
		end
		local content = table.concat(lines, "; ")

		local newVirtText = {}
		-- local suffix = ('  %d '):format(endLnum - lnum)
		local suffix = " ? " .. content
		local sufWidth = vim.fn.strdisplaywidth(suffix)
		local targetWidth = width - sufWidth
		local curWidth = 0
		local errCount = 0
		for _, chunk in ipairs(virtText) do
			local chunkText = chunk[1]
			local chunkWidth = vim.fn.strdisplaywidth(chunkText)

			if targetWidth > curWidth + chunkWidth then
				-- chunkText = chunkText:gsub("!=", "")
				if chunkText == "err" then
					errCount = errCount + 1
					if errCount ~= 2 then
						table.insert(newVirtText, { chunkText, chunk[2] })
					end
				end

				if
					chunkText ~= ";"
					and chunkText ~= "err"
					and chunkText ~= "!="
					and chunkText ~= "nil"
					and chunkText ~= "{"
					and chunkText ~= "if"
					and chunkText ~= " "
				then
					if chunkText == ":=" or chunkText == "=" then
						chunkText = " " .. chunkText .. " "
						table.insert(newVirtText, { chunkText, chunk[2] })
					elseif chunkText == "," then
						chunkText = "," .. " "
						table.insert(newVirtText, { chunkText, chunk[2] })
					else
						table.insert(newVirtText, { chunkText, chunk[2] })
					end
				end
			end
			curWidth = curWidth + vim.fn.strdisplaywidth(chunkText)
		end
		-- newVirtText = newVirtText:gsub("if ", ""):gsub("; err != nil {", "")
		table.insert(newVirtText, { suffix, "k.bracket" })
		return newVirtText
	end

	local newVirtText = {}
	local suffix = (" 󰁂 %d "):format(endLnum - lnum)
	local sufWidth = vim.fn.strdisplaywidth(suffix)
	local targetWidth = width - sufWidth
	local curWidth = 0
	for _, chunk in ipairs(virtText) do
		local chunkText = chunk[1]
		local chunkWidth = vim.fn.strdisplaywidth(chunkText)
		if targetWidth > curWidth + chunkWidth then
			table.insert(newVirtText, chunk)
		else
			chunkText = truncate(chunkText, targetWidth - curWidth)
			local hlGroup = chunk[2]
			table.insert(newVirtText, { chunkText, hlGroup })
			chunkWidth = vim.fn.strdisplaywidth(chunkText)
			-- str width returned from truncate() may less than 2nd argument, need padding
			if curWidth + chunkWidth < targetWidth then
				suffix = suffix .. (" "):rep(targetWidth - curWidth - chunkWidth)
			end
			break
		end
		curWidth = curWidth + chunkWidth
	end

	table.insert(newVirtText, { suffix, "k.bracket" })

	return newVirtText
end

return {

	-- {"kevinhwang91/nvim-ufo",
	-- dependencies = { "kevinhwang91/promise-async" },
	-- init = function()
	-- 	vim.o.fillchars = [[eob: ,fold: ,foldopen:,foldsep: ,foldclose:]]
	-- 	vim.o.foldlevel = 99 -- Using ufo provider need a large value, feel free to decrease the value
	-- 	vim.o.foldlevelstart = 99
	-- 	vim.o.foldenable = true
	-- 	vim.o.foldcolumn = "1"
	-- end,
	-- config = function()
	-- 	require("ufo").setup({
	-- 		provider_selector = function(bufnr, filetype, buftype)
	-- 			return { "treesitter", "indent" }
	-- 		end,
	-- 		fold_virt_text_handler = handler,
	-- 	})
	-- end,}
}
