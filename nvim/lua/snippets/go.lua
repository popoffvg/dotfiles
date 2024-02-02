local ls = require("luasnip")
local s = ls.s
local i = ls.i
local t = ls.t

local d = ls.dynamic_node
local c = ls.choice_node
local f = ls.function_node
local r = ls.restore_node
local sn = ls.snippet_node

local fmt = require("luasnip.extras.fmt").fmt
local fmta = require("luasnip.extras.fmt").fmta
local rep = require("luasnip.extras").rep

-- --
local tsgo = require("../custom/treesitter_go")
-- --

local snippets = {}
local autosnippets = {}

local autocmd = vim.api.nvim_create_autocmd
local augroup = vim.api.nvim_create_augroup
local map = vim.keymap.set
local opts = { noremap = true, silent = true, buffer = true }
local group = augroup("Go Snippets", { clear = true })

local pattern = "*.go"

local function cs(trigger, nodes, keymap) --> cs stands for create snippet
	local snippet = s(trigger, nodes)
	table.insert(snippets, snippet)

	if keymap ~= nil then
		local pattern = pattern
		if type(keymap) == "table" then
			pattern = keymap[1]
			keymap = keymap[2]
		end
		autocmd("BufEnter", {
			pattern = pattern,
			group = group,
			callback = function()
				map({ "i" }, keymap, function()
					ls.snip_expand(snippet)
				end, opts)
			end,
		})
	end
end

local err = s(
	"ierr",
	f(function(_, _)
		local vfn = vim.fn
		local byte_offset = vfn.wordcount().cursor_bytes
		local cmd = string.format("iferr -pos %d", byte_offset)
		local data = vfn.systemlist(cmd, vfn.bufnr("%"))
		return data
	end, {})
)
table.insert(autosnippets, err)

local my_s = s(
	"func",
	fmt(
		[[
func {}({}{}) ({}) {{
    return {}
}}
    ]],
		{
			i(1, "funcName"),
			i(2, "ctx context.Context,"),
			i(3, "params"),
			c(4, {
				i(1, "type"),
				sn(1, {
					-- f(var_name, {1}),
					i(1, "err error"),
				}),
			}),
			i(5, "err"),
		}
	)
)
table.insert(snippets, my_s)

local anonym_struct = s(
	"struct",
	fmta(
		[[
    struct {
        <> <>
    }{
        <>: <>,
    }
]],
		{
			i(1, "field"),
			i(2, "string"),
			rep(1),
			i(3, '""'),
		}
	)
)
table.insert(snippets, anonym_struct)

local struct = s(
	"struct",
	fmta(
		[[
<> struct {
    <>
}]],
		{
			i(1, "name"),
			i(2),
		}
	)
)
table.insert(snippets, struct)

local go_type = s(
	"type",
	fmta(
		[[
type(
<>
)]],
		{
			i(1),
		}
	)
)
table.insert(snippets, go_type)

local forr = s(
	{ trig = "forr", desc = "range 2" },
	fmta(
		[[
for <>, <> := range <> {
    <>
}
]],
		{
			i(1, "_"),
			i(2, "v"),
			i(3),
			i(0),
		}
	)
)
table.insert(snippets, forr)

local forc = s(
	{ trig = "forr", desc = "range" },
	fmta(
		[[
for <> := range <> {
    <>
}
]],
		{
			i(1, "v"),
			i(2),
			i(0),
		}
	)
)
table.insert(snippets, forc)

local fori = s(
	{ trig = "fori", desc = "for i" },
	fmta(
		[[
for i:= 0;i << <>;i++ {
    <>
}
]],
		{
			i(1, "N"),
			i(0),
		}
	)
)
table.insert(snippets, fori)

local arr = s(
	"arr",
	c(1, {
		fmta([[<> := make([]<>, <>)]], {
			i(1, "arr"),
			i(2, "type"),
			c(3, {
				t("0"),
				fmta([[0, <>]], { i(1, "len") }),
			}),
		}),
		fmta([[var <> []<>]], {
			i(1, "arr"),
			i(2, "type"),
		}),
	})
)
table.insert(snippets, arr)

local map = s(
	"map",
	fmta([[<> := make(map[<>]<>)]], {
		i(1, "val"),
		i(2, "key"),
		i(3, "val"),
	})
)
table.insert(snippets, map)

local var = s(
	"var",
	fmta(
		[[
var (
<>
)
]],
		{
			i(1),
		}
	)
)
table.insert(snippets, var)

local ts_locals = require("nvim-treesitter.locals")
local ts_utils = require("nvim-treesitter.ts_utils")

local get_node_text = vim.treesitter.get_node_text

local transforms = {
	int = function(_, _)
		return t("0")
	end,

	bool = function(_, _)
		return t("false")
	end,

	string = function(_, _)
		return t([[""]])
	end,

	error = function(_, info)
		if info then
			info.index = info.index + 1

			return c(info.index, {
				t(info.err_name),
				t(string.format('fmt.Errorf(%s, "%s")', info.err_name, info.func_name)),
			})
		else
			return t("err")
		end
	end,

	-- Types with a "*" mean they are pointers, so return nil
	[function(text)
		return string.find(text, "*", 1, true) ~= nil
	end] = function(_, _)
		return t("nil")
	end,
}

local transform = function(text, info)
	local condition_matches = function(condition, ...)
		print(vim.inspect(condition))
		if type(condition) == "string" then
			return condition == text
		else
			return condition(...)
		end
	end

	for condition, result in pairs(transforms) do
		if condition_matches(condition, text, info) then
			return result(text, info)
		end
	end

	return t(text)
end

local handlers = {
	parameter_list = function(node, info)
		local result = {}

		local count = node:named_child_count()
		for idx = 0, count - 1 do
			local matching_node = node:named_child(idx)
			local type_node = matching_node:field("type")[1]
			table.insert(result, transform(get_node_text(type_node, 0), info))
			if idx ~= count - 1 then
				table.insert(result, t({ ", " }))
			end
		end

		return result
	end,

	type_identifier = function(node, info)
		local text = get_node_text(node, 0)
		return { transform(text, info) }
	end,
}

local function_node_types = {
	function_declaration = true,
	method_declaration = true,
	func_literal = true,
}

local function go_result_type(info)
	local cursor_node = ts_utils.get_node_at_cursor()
	local scope = ts_locals.get_scope_tree(cursor_node, 0)

	local function_node
	for _, v in ipairs(scope) do
		if function_node_types[v:type()] then
			function_node = v
			break
		end
	end

	if not function_node then
		print("Not inside of a function")
		return t("")
	end

	local query = vim.treesitter.query.parse(
		"go",
		[[
      [
        (method_declaration result: (_) @id)
        (function_declaration result: (_) @id)
        (func_literal result: (_) @id)
      ]
    ]]
	)
	for _, node in query:iter_captures(function_node, 0) do
		if handlers[node:type()] then
			return handlers[node:type()](node, info)
		end
	end
end

local go_ret_vals = function(args)
	return sn(
		nil,
		go_result_type({
			index = 0,
			err_name = args[1][1],
			func_name = args[2][1],
		})
	)
end

local efi = s(
	"efi",
	fmta(
		[[
<val>, <err> := <f>(<args>)
if <err_same> != nil {
	return <result>
}
<finish>
]],
		{
			val = i(1),
			err = i(2, "err"),
			f = i(3),
			args = i(4),
			err_same = rep(2),
			result = d(5, go_ret_vals, { 2, 3 }),
			finish = i(0),
		}
	)
)

table.insert(autosnippets, efi)
table.insert(autosnippets, s("===", t(":=")))

local function short_name(args)
	for i, v in next, args[1] do
		return tsgo.short_name(v)
	end
end

local method = s(
	"meth",
	fmta(
		[[
    func(<>) <f>(<args>) (<args2>){
        <finish>
    }
    ]],
		{
			d(1, function(args)
				local receivers = tsgo.receivers_list()

				local row, _ = unpack(vim.api.nvim_win_get_cursor(0))
				local receiver = nil
				for r, meta in pairs(receivers) do
					if meta ~= nil and meta.row <= row then
						receiver = r
					end
				end

				if receiver == nil then
					return sn(nil, {
						f(short_name, 1),
						t(" *"),
						i(1, "receiver"),
					})
				end

				return sn(nil, i(1, receiver))
			end, {}),
			f = i(2, "function"),
			args = i(3, "args"),
			args2 = i(4, "error"),
			finish = i(0, "return nil"),
		}
	)
)
table.insert(snippets, method)

local ctx = s("ctx", t("ctx context.Context"))
table.insert(snippets, ctx)

local test = s(
	"test",
	fmta(
		[[
func Test<>(t *testing.T){
    <>
}
]],
		{
			i(1, "Name"),
			i(0),
		}
	)
)
table.insert(snippets, test)

local component = s(
	"comp[onent]",
	fmta(
		[[
        type <> struct{
        }

        func New() *<>{
            return &<>{}
        }
    ]],
		{
			i(1, "Component"),
			rep(1),
			rep(1),
		}
	)
)
table.insert(snippets, component)

local defer = s(
	"defer[func]",
	fmta(
		[[
    defer func() {
        <>
    }()
 ]],
		{ i(0) }
	)
)
table.insert(snippets, defer)

local goroutine = s(
	{ trig = "go[func]", desc = "goroutine", regExp = true },
	fmta(
		[[
    go func() {
        <>
    }()
 ]],
		{ i(0) }
	)
)
table.insert(snippets, goroutine)
local gof = s(
	{ trig = "func[call]", name = "go", desc = "go" },
	fmta(
		[[
    func() {
        <>
    }()
 ]],
		{ i(0) }
	),
	{
		condition = function(line_to_cursor, matched_trigger, captures)
			local result = line_to_cursor:match("go%s") or line_to_cursor:match("defer%s")
			return result
		end,
	}
)
table.insert(snippets, gof)

local fmterr = s({ trig = "errfmt", desc = "fmt.Errorf" }, fmta([[fmt.Errorf("<>: %w", err)]], { i(0, "msg") }))
table.insert(autosnippets, fmterr)
table.insert(snippets, fmterr)

local ifs = s(
	{ trig = "if ", desc = "if statement" },
	fmta(
		[[
if <> {
    <>
}]],
		{ i(1, "statement"), i(0) }
	)
)
table.insert(autosnippets, ifs)

return snippets, autosnippets
