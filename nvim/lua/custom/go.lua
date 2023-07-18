local opts = { noremap = true, silent = true }
local keymap = vim.api.nvim_set_keymap
local wk = require("which-key")

require('dap-go').setup({
  dap_configurations = {
    {
      type = "go",
      name = "Attach remote",
      mode = "remote",
      request = "attach",
    }
  },
    -- delve configurations
  delve = {
    -- the path to the executable dlv which will be used for debugging.
    -- by default, this is the "dlv" executable on your PATH.
    path = "dlv",
    -- time to wait for delve to initialize the debug session.
    -- default to 20 seconds
    initialize_timeout_sec = 20,
    -- a string that defines the port to start delve debugger.
    -- default to string "${port}" which instructs nvim-dap
    -- to start the process in a random available port
    port = "2345",
    -- additional args to pass to dlv
    args = {}
  }
 })

require("dapui").setup()
require'telescope'.load_extension'goimpl'
require('trevj').setup()
require('refactoring').setup({
    prompt_func_return_type = {
        go = true,
    },
    prompt_func_param_type = {
        go = true,
    },
})
wk.register({
	["<leader>cr"]= {"<cmd>lua require('telescope').extensions.refactoring.refactors()<CR>",name = "refactoring", noremap = true, silent = true, mode = "v"},
})
require("telescope").load_extension("refactoring")

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
