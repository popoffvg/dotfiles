if vim.loader then
	vim.loader.enable()
end

_G.dd = function(...)
	require("util.debug").dump(...)
end
vim.print = _G.dd

require("configs.lazy")

vim.cmd([[
    set relativenumber

    set rnu
    set clipboard=unnamedplus

    let mapleader=' '

    " Common keybindings
    inoremap jj <Esc>l
    map <c-w> <Cmd>:Bdelete<CR>
    map <c-W>:bd
    imap <a-o> <Esc>o
    imap <a-a> <Esc>a
    imap <a-A> <Esc>A
    imap <a-O> <Esc>O
    nnoremap <c-a> ggVGG

    nnoremap <esc> :noh<return><esc>
    nnoremap <esc>^[ <esc>^[
    nnoremap <A-h> ^
    nnoremap <A-l> $
    nnoremap <A-j> :m .+1<CR>==
    nnoremap <A-k> :m .-2<CR>==
    nnoremap <c><left><left> ^
    nnoremap <c><Right><Right> $

    imap <a-h> <backspace>
    imap <A-j> <Esc>:m .+1<CR>==gi
    imap <A-k> <Esc>:m .-2<CR>==gi
    imap <A-=> :=

    vnoremap <A-j> :m '>+1<CR>gv=gv
    vnoremap <A-k> :m '<-2<CR>gv=gv
    vnoremap <A-h> ^
    vnoremap <A-l> $

    " Windows navigation
    nnoremap <C-J> <C-W><C-J>
    nnoremap <C-K> <C-W><C-K>
    nnoremap <C-L> <C-W><C-L>
    nnoremap <C-H> <C-W><C-H>
    nnoremap <C-z> :ZenMode<CR>


    " Copy to system clipboard
    noremap <Leader>y "*y
    noremap <Leader>p "*p
    noremap <Leader>Y "+y
    noremap <Leader>P "+p

    " Terminal map
    tnoremap <Esc> <C-\><C-n>
    tnoremap jj <C-\><C-n>
    tnoremap <C-J> <C-\><C-n><C-W><C-J>
    tnoremap <C-K> <C-\><C-n><C-W><C-K>
    tnoremap <C-L> <C-\><C-n><C-W><C-L>
    tnoremap <C-H> <C-\><C-n><C-W><C-H>
    tnoremap <C-z> <C-\><C-n>:ZenMode<CR><C-\><C-n>
    autocmd BufWinEnter,WinEnter term://* startinsert
]])

vim.cmd([[
    " general
    set noswapfile

    " editing
    " How many columns of whitespace a \t is worth
    set tabstop=4
    set shiftwidth=4 " Use spaces when tabbing
    set expandtab

    "" Encoding
    set encoding=utf-8
    set fileencoding=utf-8
    set fileencodings=utf-8
    set ttyfast

    "" Fix backspace indent
    set backspace=indent,eol,start

    "" Tabs. May be overridden by autocmd rules
    set tabstop=4
    set softtabstop=0
    set shiftwidth=4
    set expandtab

    "" Map leader to ,
    let mapleader=' '

    "" Enable hidden buffers
    set hidden

    "" Searching
    set hlsearch
    set incsearch
    set ignorecase
    set smartcase
    nnoremap <esc> :noh<return><esc>

    "*****************************************************************************
    "" Visual Settings
    "*****************************************************************************
    set nocompatible
    syntax on
    filetype off
    filetype plugin indent on
    set runtimepath+=$GOROOT/misc/vim
    set ruler
    set number

    let no_buffers_menu=1

    set laststatus=3 " global status line

    set spelllang=en_us
    set nospell

    " set wildmode=longest,list,full
    " Better command line completion 
    " set wildmenu=off

    " mouse support
    set mouse=vn

    set mousemodel=popup
    set t_Co=256
    set guioptions=egmrti
    if has('gui_running')
      set guifont=Roboto\ Mono\ 10
    endif
    " colorscheme github_*
    " colorscheme catppuccin-mocha " catppuccin-latte, catppuccin-frappe, catppuccin-macchiato, catppuccin-mocha catppuccin
    set termguicolors
    " autocmd ColorScheme zenbones lua require "custom.theme"
    " autocmd ColorScheme neobones lua require "custom.theme"
    colorscheme neobones

    " colorscheme pencil
    let g:pencil_higher_contrast_ui = 1
    let g:pencil_neutral_code_bg = 1
    set guicursor=r-i-ci:hor5

    " for quick-scope
    let g:qs_highlight_on_keys = ['f', 'F', 't', 'T']
    highlight QuickScopePrimary guifg='#fc2642' gui=underline ctermfg=155 cterm=underline
    highlight QuickScopeSecondary guifg='#26fcf5' gui=underline ctermfg=81 cterm=underline

    " special characters
    syntax match keyword "\<lambda\>" conceal cchar=λ
    " syntax match keyword "!=" conceal cchar=≠ 
    syntax match keyword "->" conceal cchar=→ 
    syntax match keyword "<-" conceal cchar=←
    set conceallevel=1

    set ttimeout ttimeoutlen=50
    " kitty nav 
    " let g:kitty_navigator_no_mappings = 1
    " nnoremap <silent> <a-h> :KittyNavigateLeft<cr>
    " nnoremap <silent> <a-j> :KittyNavigateDown<cr>
    " nnoremap <silent> <a-k> :KittyNavigateUp<cr>
    " nnoremap <silent> <a-l> :KittyNavigateRight<cr>

    " highlight the visual selection after pressing enter.
    xnoremap <silent> <cr> "*y:silent! let searchTerm = '\V'.substitute(escape(@*, '\/'), "\n", '\\n', "g") <bar> let @/ = searchTerm <bar> echo '/'.@/ <bar> call histadd("search", searchTerm) <bar> set hls<cr>
]])
