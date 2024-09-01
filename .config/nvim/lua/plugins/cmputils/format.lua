module = {}
local lspkind = require("lspkind")
local get_mode = function()
	local mode = vim.api.nvim_get_mode().mode:sub(1, 1)
	if mode == "i" then
		return "i" -- insert
	elseif mode == "v" or mode == "V" or mode == CTRL_V then
		return "x" -- visual
	elseif mode == "s" or mode == "S" or mode == CTRL_S then
		return "s" -- select
	elseif mode == "c" and vim.fn.getcmdtype() ~= "=" then
		return "c" -- cmdline
	end
end

local function findLast(haystack, needle)
	local i = haystack:match(".*" .. needle .. "()")
	if i == nil then
		return nil
	else
		return i - 1
	end
end

--[[ local function trim_detail(detail)
    if detail then
        detail = vim.trim(detail)
        if vim.startswith(detail, "(use") then
            detail = string.sub(detail, 6, #detail)
        end
        local last = findLast(detail, "%:")
        if last then
            local last_item = detail:sub(last + 1, #detail - 1)
            detail = detail:sub(1, last - 2)
            detail = last_item .. " " .. detail
            detail = "(" .. detail .. ")"
        else
            detail = "(" .. detail
        end
    end
    return detail
end ]]
function trim_detail(detail)
	if detail then
		detail = vim.trim(detail)
		if vim.startswith(detail, "(use") then
			detail = string.sub(detail, 6, #detail)
			detail = "(" .. detail
		end
	end
	return detail
end

local function match_fn(description)
	return string.match(description, "^pub fn")
		or string.match(description, "^fn")
		or string.match(description, "^unsafe fn")
		or string.match(description, "^pub unsafe fn")
		or string.match(description, "^pub const unsafe fn")
		or string.match(description, "^const fn")
		or string.match(description, "^pub const fn")
end

function Rust(entry, vim_item)
	local kind = lspkind.cmp_format({
		mode = "symbol_text",
	})(entry, vim_item)
	local strings = vim.split(kind.kind, "%s", { trimempty = true })
	local completion_item = entry:get_completion_item()
	local item_kind = entry:get_kind() --- @type lsp.CompletionItemKind | number

	local label_detail = completion_item.labelDetails
	if item_kind == 3 or item_kind == 2 then -- Function/Method
		--[[ labelDetails.
        function#function#if detail: {
          description = "pub fn shl(self, rhs: Rhs) -> Self::Output",
          detail = " (use std::ops::Shl)"
        } ]]
		if label_detail then
			local detail = label_detail.detail
			detail = trim_detail(detail)
			local description = label_detail.description
			if description then
				if string.sub(description, #description, #description) == "," then
					description = description:sub(1, #description - 1)
				end
			end
			if
				(detail and vim.startswith(detail, "macro")) or (description and vim.startswith(description, "macro"))
			then
				kind.concat = kind.abbr
				goto OUT
			end
			if detail and description then
				if match_fn(description) then
					local start_index, _ = string.find(description, "(", nil, true)
					if start_index then
						description = description:sub(start_index, #description)
					end
				end
				local index = string.find(kind.abbr, "(", nil, true)
				-- description: "macro simd_swizzle"
				-- detail: " (use std::simd::simd_swizzle)"
				if index then
					local prefix = string.sub(kind.abbr, 1, index - 1)
					kind.abbr = prefix .. description .. " " .. detail
					kind.concat = "fn " .. prefix .. description .. "{}//" .. detail
					kind.offset = 3
				else
					kind.concat = kind.abbr .. "  //" .. detail
					kind.abbr = kind.abbr .. " " .. detail
				end
			elseif detail then
				kind.concat = "fn " .. kind.abbr .. "{}//" .. detail
				kind.abbr = kind.abbr .. " " .. detail
			elseif description then
				if match_fn(description) then
					local start_index, _ = string.find(description, "%(")
					if start_index then
						description = description:sub(start_index, #description)
					end
				end
				local index = string.find(kind.abbr, "(", nil, true)
				if index then
					local prefix = string.sub(kind.abbr, 1, index - 1)
					kind.abbr = prefix .. description .. " "
					kind.concat = "fn " .. prefix .. description .. "{}//"
					kind.offset = 3
				else
					kind.concat = kind.abbr .. "  //" .. description
					kind.abbr = kind.abbr .. " " .. description
				end
			else
				kind.concat = kind.abbr
			end
		end
	elseif item_kind == 15 then
	elseif item_kind == 5 then -- Field
		local detail = completion_item.detail
		detail = trim_detail(detail)
		if detail then
			kind.concat = "struct S {" .. kind.abbr .. ": " .. detail .. "}"
			kind.abbr = kind.abbr .. ": " .. detail
		else
			kind.concat = "struct S {" .. kind.abbr .. ": String" .. "}"
		end
		kind.offset = 10
	elseif item_kind == 6 or item_kind == 21 then -- variable constant
		if label_detail then
			local detail = label_detail.description
			if detail then
				kind.concat = "let " .. kind.abbr .. ": " .. detail
				kind.abbr = kind.abbr .. ": " .. detail
				kind.offset = 4
			else
				kind.concat = kind.abbr
			end
		end
	elseif item_kind == 9 then -- Module
		local detail = label_detail.detail
		detail = trim_detail(detail)
		if detail then
			kind.concat = kind.abbr .. "  //" .. detail
			kind.abbr = kind.abbr .. " " .. detail
			kind.offset = 0
		else
			kind.concat = kind.abbr
		end
	elseif item_kind == 8 then -- Trait
		local detail = label_detail.detail
		detail = trim_detail(detail)
		if detail then
			kind.concat = "trait " .. kind.abbr .. "{}//" .. detail
			kind.abbr = kind.abbr .. " " .. detail
		else
			kind.concat = "trait " .. kind.abbr .. "{}"
			kind.abbr = kind.abbr
		end
		kind.offset = 6
	elseif item_kind == 22 then -- Struct
		local detail = label_detail.detail
		detail = trim_detail(detail)
		if detail then
			kind.concat = kind.abbr .. "  //" .. detail
			kind.abbr = kind.abbr .. " " .. detail
		else
			kind.concat = kind.abbr
		end
	elseif item_kind == 1 then -- "Text"
		kind.concat = '"' .. kind.abbr .. '"'
		kind.offset = 1
	elseif item_kind == 14 then
		if kind.abbr == "mut" then
			kind.concat = "let mut"
			kind.offset = 4
		else
			kind.concat = kind.abbr
		end
	else
		-- if label_detail then
		--     local detail = label_detail.detail
		--     local description = label_detail.description
		--     if detail then
		--         kind.abbr = kind.abbr .. " " .. detail
		--     end
		--     if description then
		--         kind.abbr = kind.abbr .. " " .. description
		--     end
		-- end
		-- if completion_item.detail then
		--     kind.abbr = kind.abbr .. " " .. completion_item.detail
		-- end
		kind.concat = kind.abbr
	end
	if item_kind == 15 then
		kind.concat = ""
	end
	::OUT::
	kind.kind = " " .. (strings[1] or "") .. " "
	kind.menu = nil
	if string.len(kind.abbr) > 60 then
		kind.abbr = kind.abbr:sub(1, 60)
	end
	return kind
end

function module.Lua(entry, vim_item)
	local kind = lspkind.cmp_format({
		mode = "symbol_text",
	})(entry, vim_item)
	local strings = vim.split(kind.kind, "%s", { trimempty = true })
	local item_kind = entry:get_kind() --- @type lsp.CompletionItemKind | number
	if item_kind == 5 then -- Field
		kind.concat = "v." .. kind.abbr
		kind.offset = 2
	elseif item_kind == 1 then -- Text
		kind.concat = '"' .. kind.abbr .. '"'
		kind.offset = 1
	else
		kind.concat = kind.abbr
	end
	kind.abbr = kind.abbr
	kind.kind = " " .. (strings[1] or "") .. " "
	kind.menu = nil
	if string.len(kind.abbr) > 50 then
		kind.abbr = kind.abbr:sub(1, 50)
	end
	return kind
end

function module.Go(entry, vim_item)
	local kind = lspkind.cmp_format({
		mode = "symbol_text",
	})(entry, vim_item)
	local strings = vim.split(kind.kind, "%s", { trimempty = true })
	local item_kind = entry:get_kind() --- @type lsp.CompletionItemKind | number
	local completion_item = entry:get_completion_item()

	local detail = completion_item.detail
	if item_kind == 5 then -- Field
		if detail then
			local last = findLast(kind.abbr, "%.")
			if last then
				local catstr = kind.abbr:sub(last + 1, #kind.abbr)
				local space_hole = string.rep(" ", last)
				kind.concat = "type T struct{" .. space_hole .. catstr .. " " .. detail .. "}"
				kind.offset = 14
				kind.abbr = kind.abbr .. " " .. detail
			else
				kind.concat = "type T struct{" .. kind.abbr .. " " .. detail .. "}"
				kind.offset = 14
				kind.abbr = kind.abbr .. " " .. detail
			end
		else
			kind.concat = "type T struct{" .. kind.abbr .. " " .. "}"
			kind.offset = 14
			kind.abbr = kind.abbr .. " " .. detail
		end
	elseif item_kind == 1 then -- Text
		kind.concat = '"' .. kind.abbr .. '"'
		kind.offset = 1
	elseif item_kind == 6 or item_kind == 21 then -- Variable
		local last = findLast(kind.abbr, "%.")
		if detail then
			if last then
				local catstr = kind.abbr:sub(last + 1, #kind.abbr)
				local space_hole = string.rep(" ", last)
				kind.concat = "var " .. space_hole .. catstr .. " " .. detail
				kind.offset = 4
				kind.abbr = kind.abbr .. " " .. detail
			else
				if detail then
					kind.concat = "var " .. kind.abbr .. " " .. detail
					kind.abbr = kind.abbr .. " " .. detail
					kind.offset = 4
				end
			end
		end
	elseif item_kind == 22 then -- Struct
		local last = findLast(kind.abbr, "%.")
		if last then
			local catstr = kind.abbr:sub(last + 1, #kind.abbr)
			local space_hole = string.rep(" ", last)
			kind.concat = "type " .. space_hole .. catstr .. " struct{}"
			kind.offset = 5
			kind.abbr = kind.abbr .. " struct{}"
		else
			kind.concat = "type " .. kind.abbr .. " struct{}"
			kind.abbr = kind.abbr .. " struct{}"
			kind.offset = 5
		end
	elseif item_kind == 3 or item_kind == 2 then -- Function/Method
		local last = findLast(kind.abbr, "%.")
		if last then
			if detail then
				detail = detail:sub(5, #detail)
				kind.abbr = kind.abbr .. detail
				local catstr = kind.abbr:sub(last + 1, #kind.abbr)
				local space_hole = string.rep(" ", last)
				kind.concat = "func " .. space_hole .. catstr .. "{}"
				kind.offset = 5
			else
				kind.concat = "func " .. kind.abbr .. "(){}"
				kind.offset = 5
			end
		else
			if detail then
				detail = detail:sub(5, #detail)
				kind.abbr = kind.abbr .. detail
				kind.concat = "func " .. kind.abbr .. "{}"
				kind.offset = 5
			else
				kind.concat = "func " .. kind.abbr .. "(){}"
				kind.abbr = kind.abbr
				kind.offset = 5
			end
		end
	elseif item_kind == 9 then -- Module
		if detail then
			kind.offset = 6 - #kind.abbr
			kind.abbr = kind.abbr .. " " .. detail
			kind.concat = "import " .. detail
		end
	elseif item_kind == 8 then -- Interface
		local last = findLast(kind.abbr, "%.")
		if last then
			local catstr = kind.abbr:sub(last + 1, #kind.abbr)
			local space_hole = string.rep(" ", last)
			kind.concat = "type " .. space_hole .. catstr .. " interface{}"
			kind.offset = 5
			kind.abbr = kind.abbr .. " interface{}"
		else
			kind.concat = "type " .. kind.abbr .. " interface{}"
			kind.abbr = kind.abbr .. " interface{}"
			kind.offset = 5
		end
	else
		kind.concat = kind.abbr
	end
	kind.kind = " " .. (strings[1] or "") .. " "
	kind.menu = ""
	if string.len(kind.abbr) > 50 then
		kind.abbr = kind.abbr:sub(1, 50)
	end
	return kind
end

function module.Common(e, item)
	local kind = lspkind.cmp_format({
		mode = "symbol_text",
		-- show_labelDetails = true, -- show labelDetails in menu. Disabled by default
	})(e, item)
	local strings = vim.split(kind.kind, "%s", { trimempty = true })
	kind.kind = " " .. (strings[1] or "") .. " "
	kind.menu = ""
	kind.concat = kind.abbr
	return kind
end

return module
