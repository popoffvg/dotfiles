local M = {}

local query_string = [[
(
 (method_declaration 
   receiver:
   (parameter_list
    (parameter_declaration) @receiver (#offset! @receiver)
    ))
)
]]

local function get_receivers(bufnr, lang, query_string)
  local receivers_list = {}

  local parser = vim.treesitter.get_parser(bufnr,lang)
  local syntax_tree = parser:parse()[1]
  local root = syntax_tree:root()
  local query = vim.treesitter.query.parse(lang, query_string)
  local hash = {}

  for _, captures, metadata in query:iter_matches(root, bufnr) do
    local row, col, _ = captures[1]:start()
    local receiver = vim.treesitter.get_node_text(captures[1], bufnr)
    if not receivers_list[receiver] then
        receivers_list[receiver] = {row = row, column = column}
    end
  end

  return receivers_list
end

function M.receivers_list()
    bufnr = vim.api.nvim_get_current_buf()
    lang =  vim.api.nvim_buf_get_option(bufnr, "filetype")
    local receivers = get_receivers(bufnr, lang, query_string)

    if vim.tbl_isempty(receivers) then
        return {}
    end

    return receivers
end

function M.short_name(str)
    local upperCharacter
    for token in string.gmatch(str,'%u') do
       upperCharacter = token:lower()
    end

    if upperCharacter == nil then
        return str:sub(1,1)
    end
    
    return upperCharacter
end

-- vim.api.nvim_create_user_command('Prose', function()
--     M.receivers_list()
--   end,                                                                                                                                  
--   {nargs = 0, desc = 'Apply prose settings'}                                                                                                       
-- )      

return M
