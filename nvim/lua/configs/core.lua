vim.cmd([[
        set relativenumber
        set rnu
        set clipboard=unnamedplus

        let mapleader=' '

        " Common keybindings
        inoremap jj <Esc>l
        map <Leader>q <Cmd>:Bdelete<CR>
        map <Leader>Q <Cmd>:bd<CR>
        imap <m-o> <Esc>o
        imap <m-a> <Esc>a
        imap <m-A> <Esc>A
        imap <m-O> <Esc>O
        nnoremap <m-a> ggVGG

        nnoremap <silent> <ESC> :nohlsearch<CR>
        nnoremap <esc>^[ <esc>^[
        nnoremap <m-h> ^
        nnoremap <m-l> $
        nnoremap <c><left><left> ^
        nnoremap <c><Right><Right> $

        imap <m-h> <backspace>
        imap <m-=> :=

        vnoremap <m-h> ^
        vnoremap <m-l> $

        " Windows navigation
        nnoremap <C-J> <C-W><C-J>
        nnoremap <C-K> <C-W><C-K>
        nnoremap <C-L> <C-W><C-L>
        nnoremap <C-H> <C-W><C-H>
        nnoremap <leader>z :ZenMode<CR>


        " Copy to system clipboard
        " noremap <Leader>y "*y
        " noremap <Leader>p "*p
        " noremap <Leader>Y "+y
        " noremap <Leader>P "+p

        " Terminal map
        tnoremap <Esc> <C-\><C-n>
        tnoremap jj <C-\><C-n>
        tnoremap <C-J> <C-\><C-n><C-W><C-J>
        tnoremap <C-K> <C-\><C-n><C-W><C-K>
        tnoremap <C-L> <C-\><C-n><C-W><C-L>
        tnoremap <C-H> <C-\><C-n><C-W><C-H>
        autocmd BufWinEnter,WinEnter term://* startinsert

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

    "" Enable hidden buffers
    set hidden

    "" Searching
    set hlsearch
    set incsearch
    set ignorecase
    set smartcase

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
      set guifont=Fira\ Mono 12
    endif

    let g:pencil_higher_contrast_ui = 1
    let g:pencil_neutral_code_bg = 1
    set guicursor=r-i-ci:hor5


    " special characters
    syntax match keyword "\<lambda\>" conceal cchar=λ
    " syntax match keyword "!=" conceal cchar=≠ 
    syntax match keyword "->" conceal cchar=→ 
    syntax match keyword "<-" conceal cchar=←
    set conceallevel=1

    set ttimeout ttimeoutlen=50

    " highlight the visual selection after pressing enter.
    xnoremap <silent> <cr> "*y:silent! let searchTerm = '\V'.substitute(escape(@*, '\/'), "\n", '\\n', "g") <bar> let @/ = searchTerm <bar> echo '/'.@/ <bar> call histadd("search", searchTerm) <bar> set hls<cr>


    "split | vsplit highlight
    hi vertsplit guifg=fg guibg=bg
    " hi vertsplit guifg=fg guibg=bg
]])
