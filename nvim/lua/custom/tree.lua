local HEIGHT_RATIO = 0.8  -- You can change this
local WIDTH_RATIO = 0.5   -- You can change this /* TODO: (popoffvg) 

local opts = { noremap = true, silent = true }
local keymap = vim.api.nvim_set_keymap

require'nvim-tree'.setup{
    disable_netrw = true,
    -- open_on_setup_file = false,
    respect_buf_cwd = false,
    diagnostics = {
        enable = true,
    },
    view = {
    float = {
      enable = true,
      quit_on_focus_loss = false,
      open_win_config = function()
        local screen_w = vim.opt.columns:get()
        local screen_h = vim.opt.lines:get() - vim.opt.cmdheight:get()
        local window_w = screen_w * WIDTH_RATIO
        local window_h = screen_h * HEIGHT_RATIO
        local window_w_int = math.floor(window_w)
        local window_h_int = math.floor(window_h)
        local center_x = (screen_w - window_w) / 2
        local center_y = ((vim.opt.lines:get() - window_h) / 2)
                         - vim.opt.cmdheight:get()
        return {
          border = 'rounded',
          relative = 'editor',
          row = center_y,
          col = center_x,
          width = window_w_int,
          height = window_h_int,
        }
        end,
    },

    width = function()
      return math.floor(vim.opt.columns:get() * WIDTH_RATIO)
    end,
  },
    actions = {
        open_file = {
            quit_on_open = true
        }
    },
}

keymap("n", "<leader>vo", ":NvimTreeOpen<CR>", opts)
keymap("n", "<leader>vv", ":NvimTreeToggle<CR>", opts)
keymap("n", "<leader>vf", ":NvimTreeFindFile<CR>", opts)
-- vim.api.nvim_create_autocmd({"BufReadPost"}, {
--  callback = function(args)
--    if vim.fn.expand "%:p" ~= "" then
--        vim.api.nvim_del_autocmd(args.id)
--        vim.cmd ":lua require('nvim-tree').toggle(false, true)"
--    end
--  end,
-- })
-- -- nvim-tree is also there in modified buffers so this function filter it out
local modifiedBufs = function(bufs)
    local t = 0
    for k,v in pairs(bufs) do
        if v.name:match("NvimTree_") == nil then
            t = t + 1
        end
    end
    return t
end

vim.api.nvim_create_autocmd("BufEnter", {
    nested = true,
    callback = function()
        if #vim.api.nvim_list_wins() == 1 and
        vim.api.nvim_buf_get_name(0):match("NvimTree_") ~= nil and
        modifiedBufs(vim.fn.getbufinfo({bufmodified = 1})) == 0 then
            vim.cmd "quit"
        end
    end
})
