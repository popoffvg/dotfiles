local ls = require("luasnip")
local s = ls.s
local i = ls.i
local t = ls.t

local d = ls.dynamic_node
local c = ls.choice_node
local f = ls.function_node
local sn = ls.snippet_node

local fmt = require("luasnip.extras.fmt").fmta
local rep = require("luasnip.extras").rep

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

local function lp(package_name) -- Load Package Function
	package.loaded[package_name] = nil
	return require(package_name)
end

-- Utility Functions --

-- Start Refactoring --


local query_s = s(
    "query",
    fmt(
    [[
type (
    <name> struct {
    params map[string]interface{}
    Result *[]string
  }
  )

func <name>(<params>) *<name> {
  query := &updateForecastInfo{
    params: map[string]interface{}{
        <transformParams>
    },
    Result: result,
  }

  return query
}

func (a *<name>) Query() interface{} {
  return <query>
  
}

// nolint
func (*<name>) String() string {
  return "UpdateForecastInfo"
}

// Params возвращает список параметров запроса
func (a *<name>) Params() interface{} {
  return a.params
}

func (a *<name>) Destination() interface{} {
  return &a.Result
}
]],{
       name = i(1),
       params = i(1),
       transformParams = i(1),
       query = i(1),
    }
    ))
table.insert(snippets, query_s)

-- Start Refactoring --

return snippets, autosnippets
