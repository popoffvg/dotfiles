local M = {}

function M.remove_duplicate(table)
    local hash = {}
    local res = {}

    for k,v in ipairs(test) do
       if (not hash[k]) then
           res[k] = v -- you could print here instead of saving to result table if you wanted
           hash[k] = true
       end
    end

    return res
end

return M
