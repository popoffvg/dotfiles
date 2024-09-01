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
local tsgo = require("../utils/treesitter_go")
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

table.insert(
	autosnippets,
	s(
		"ie",
		fmta(
			[[
if err != nil {
     <>
}
]],
			{
				i(0),
			}
		)
	)
)

local err = s(
	"ierr",
	f(function(_, _)
		local vfn = vim.fn
		local byte_offset = vfn.wordcount().cursor_bytes
		local cmd = string.format("gen-return -pos %d", byte_offset)
		local data = vfn.systemlist(cmd, vfn.bufnr("%"))
		return data
	end, {})
)
table.insert(snippets, err)

local err = s(
	"rn",
	f(function(_, _)
		local vfn = vim.fn
		local byte_offset = vfn.wordcount().cursor_bytes
		local cmd = string.format("gen-return -return -pos %d", byte_offset)
		local data = vfn.systemlist(cmd, vfn.bufnr("%"))
		return data
	end, {})
)
table.insert(autosnippets, err)

local my_s = s(
	"func[new]",
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
	"struct[anonym]",
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
	"struct[new]",
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
	{ trig = "for[range 2]", desc = "range 2" },
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
	{ trig = "for[range]", desc = "range" },
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
	{ trig = "for[i]", desc = "for i" },
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

local chan = s(
	"make[chan]",
	c(1, {
		fmta([[<> := make(chan <>, <>)]], {
			i(1, "ch"),
			i(2, "bool"),
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
table.insert(snippets, chan)

local arr = s(
	"make[arr]",
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
	"make[map]",
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
	"test[new]",
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

        func New<>() *<>{
            return &<>{}
        }
    ]],
		{
			i(1, "Component"),
			rep(1),
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
	{ trig = "func[anonym]", name = "go", desc = "go" },
	fmta(
		[[
        func() {
            <>
        }()
 ]],
		{ i(0) }
	),
	{
		show_condition = function(line_to_cursor)
			local result = line_to_cursor:match("go%s") or line_to_cursor:match("defer%s")
			return result
		end,
	}
)
table.insert(snippets, gof)

local fmterr = s({ trig = "errfmt", desc = "fmt.Errorf" }, fmta([[fmt.Errorf("<>: %w", err)]], { i(0, "msg") }))
table.insert(autosnippets, fmterr)

local ifs = s(
	{ trig = "if ", desc = "if statement" },
	fmta(
		[[
if <> {
    <>
}
        ]],
		{ i(1, "statement"), i(0) }
	),
	{
		condition = function(line_to_cursor, matched_trigger, captures)
			return line_to_cursor:match("^%s*if")
		end,
	}
)
table.insert(snippets, ifs)

local tag = s({ trig = "tag", name = "struct tag" }, fmta('`<>:"<>"`', { i(1, "json"), i(0, "value") }))
table.insert(autosnippets, tag)

return snippets, autosnippets
