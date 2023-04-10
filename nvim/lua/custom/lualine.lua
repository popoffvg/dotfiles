local treesitter = require('nvim-treesitter')

local transform_line = function(line)
  print(vim.inspect("test"..line))
  return line:gsub('%s*[%[%(%{]*%s*$', '')
end

local function treelocation()
  return treesitter.statusline({
    indicator_size = 90,
    type_patterns = {'class', 'function', 'method', 'interface', 'type_spec'},
    separator = ' -> ',
    transfrom_fn = transform_line
  })
end

require('lualine').setup({
    tabline = {},
    sections = {
      lualine_b = {'branch', 'diff', 'diagnostics'},
      lualine_c = {'filename', treelocation},
      lualine_x = {'tabs'},
    },
})


