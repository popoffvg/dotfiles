local treesitter = require('nvim-treesitter')

local transform_line = function(line)
  -- print(vim.inspect("test"..line))
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
    options = {
         component_separators = '|',
        section_separators = { left = '', right = '' },
        globalstatus = true,
      },
    tabline = {},
    sections = {
     lualine_a = {
         -- { 'mode', separator = { left = '' }, right_padding = 2 }
         { 'mode', right_padding = 2 },
 },
      -- lualine_b = {'branch', 'diff', {'diagnostics', sources = {'nvim'}}},
      lualine_c = {'filename'}
      -- lualine_x = {'tabs',separator = { right = '' }, left_padding = 2 },

    },
})


