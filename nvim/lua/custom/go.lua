local opts = { noremap = true, silent = true }
local keymap = vim.api.nvim_set_keymap

require('dap-go').setup()
require("dapui").setup()
require'telescope'.load_extension'goimpl'
require('trevj').setup()

local wk = require("which-key")
wk.register({
    ["<leader>ci"] = {"<cmd>lua require'telescope'.extensions.goimpl.goimpl{}<CR>]", "implement interface", noremap = true, silent = true},
    ["<F5>"] = {"<Cmd>lua require'dap'.continue()<CR>", "debug.continue", silent=true, noremap = true}
})

vim.cmd [[
    syntax match keyword "\<lambda\>" conceal cchar=λ
    set conceallevel=1
    let g:go_doc_keywordprg_enabled = 0

    " nnoremap <silent> <F5> <Cmd>lua require'dap'.continue()<CR>
    nnoremap <silent> <F10> <Cmd>lua require'dap'.step_over()<CR>
    nnoremap <silent> <F11> <Cmd>lua require'dap'.step_into()<CR>
    nnoremap <silent> <F12> <Cmd>lua require'dap'.step_out()<CR>
    nnoremap <silent> <F9> <Cmd>lua require'dap'.toggle_breakpoint()<CR>
    " nnoremap <silent> <Leader>B <Cmd>lua require'dap'.set_breakpoint(vim.fn.input('Breakpoint condition: '))<CR>
    " nnoremap <silent> <Leader>lp <Cmd>lua require'dap'.set_breakpoint(nil, nil, vim.fn.input('Log point message: '))<CR>

    nnoremap <silent> <Leader>dl <Cmd>lua require'dap'.run_last()<CR>
    nnoremap <silent> <Leader>du <Cmd>lua require("dapui").toggle()<CR>
    nnoremap <silent> <Leader>dr <Cmd>lua require("dapui").debug_test()<CR>

    nnoremap <silent> <Leader>j <Cmd>lua require('trevj').format_at_cursor()<CR>
]]

-- vim.api.nvim_set_keymap('n', '<leader>im', [[<cmd>lua require'telescope'.extensions.goimpl.goimpl{}<CR>]], {noremap=true, silent=true})
    -- nnoremap <silent> <Leader>dr <Cmd>lua require'dap'.repl.open()<CR>
