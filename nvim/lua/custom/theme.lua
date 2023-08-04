local lush = require "lush"
local base = require "neobones"
local color = lush.hsluv(250,100,40)

-- vim.g.zenbones_solid_line_nr = true
-- vim.g.zenbones_darken_comments = 90

local palette = require "neobones.palette"
-- print(vim.inspect())
-- Create some specs
local specs = lush.parse(function(injected_functions)
    local sym = injected_functions.sym
	return {
		-- Constant { base.Constant, fg = color, gui = "italic"},
       sym "@string" { base["@constant"], bg = palette.light.water ,gui = "bold"},
        sym "@comment" {gui="underline"},
        Function { fg = color}
	}
end)

-- Apply specs using lush tool-chain
lush.apply(lush.compile(specs))


