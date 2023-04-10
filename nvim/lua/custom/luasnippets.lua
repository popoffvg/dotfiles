-- Load VS Code snippets
-- require("luasnip.loaders.from_vscode").lazy_load()

local ls = require("luasnip")
local s = ls.snippet
local f = ls.function_node
local types = require("luasnip.util.types")

-- hot reload snippets
require("luasnip.loaders.from_lua").load({ paths = "~/.config/nvim/lua/snippets/" })
vim.cmd([[command! LuaSnipEdit :lua require("luasnip.loaders.from_lua").edit_snippet_files()]]) --}}}

local types = require("luasnip.util.types")
-- Config
ls.config.setup({
	-- This tells LuaSnip to remember to keep around the last snippet.
	-- You can jump back into it even if you move outside of the selection
	history = true,

	-- Updates as you type
	updateevents = "TextChanged,TextChangedI",
    enable_autosnippets = true,
    ext_opts = {
        [types.choiceNode] = {
            active = {
                hl_group = "GruvboxBlue",
            },
        },
    },
    ext_base_prio = 200,
	ext_prio_increase = 2,
})

vim.keymap.set("n", "<Leader><CR>", "<cmd>LuaSnipEdit<cr>", { silent = true, noremap = true })
vim.cmd([[autocmd BufEnter */snippets/*.lua nnoremap <silent> <buffer> <CR> /-- End Refactoring --<CR>O<Esc>O]])

local function comment(notation)
	local entry = vim.split(vim.opt.commentstring:get(), "%", true)[1]:gsub(" ", "")

	return string.format("%s %s: (%s) ", entry, notation, os.getenv("USER"))
end

vim.keymap.set({ "i", "s" }, "<a-p>", function()
	if ls.expand_or_jumpable() then
		ls.expand()
	end
end, { silent = true })

vim.keymap.set({ "i", "s" }, "<c-u>", '<cmd>lua require("luasnip.extras.select_choice")()<cr><C-c><C-c>')
vim.keymap.set({ "i", "s" }, "<a-l>", function()
    ls.jump(1)
end)
vim.keymap.set({ "i", "s" }, "<a-h>", function()
    ls.jump(-1)
end) --}}}

vim.keymap.set({ "i", "s" }, "<a-j>", function()
	if ls.choice_active() then
		ls.change_choice(1)
	else
        return '<a-j>'
	end
end)
vim.keymap.set({ "i", "s" }, "<a-k>", function()
	if ls.choice_active() then
		ls.change_choice(-1)
    else
        return '<a-k>'
	end
end) --}}}

-- General snippets
ls.add_snippets("all", {
	s(
		"todo",
		f(function()
			return comment("TODO:")
		end)
	),
	s(
		"note",
		f(function()
			return comment("NOTE:")
		end)
	),
	s(
		"fix",
		f(function()
			return comment("FIX:")
		end)
	),
	s(
		"warn",
		f(function()
			return comment("WARNING:")
		end)
	),
	s(
		"hack",
		f(function()
			return comment("HACK:")
		end)
	),
})

leave_snippet = function()
  local active_node = ls.session.current_nodes[vim.api.nvim_get_current_buf()]
  if ((vim.v.event.old_mode == "s" and vim.v.event.new_mode == "n") or
      vim.v.event.old_mode == "i") and active_node and not ls.session.jump_active then
    while active_node do
      if active_node.virt_text_id then
        vim.api.nvim_buf_del_extmark(0, ls.session.ns_id, active_node.virt_text_id)
        -- break -- If you know there will only ever be a single instance of virtual text
      end
      active_node = active_node.parent
    end
    ls.unlink_current()
  end
end

local snippet_augroup = vim.api.nvim_create_augroup("snippets", {clear = true})
vim.api.nvim_create_autocmd({"ModeChanged"}, {
  pattern = {"*"},
  command = "lua leave_snippet()",
  group = snippet_augroup
})
