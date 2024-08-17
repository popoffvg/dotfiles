vim.keymap.set("n", "M", "J") -- mnemonic: [M]erge
vim.keymap.set("n", "<leader>h", "K") -- mnemonic: [h]over

vim.cmd([[
        set updatetime=30000
        set relativenumber
        set rnu
        set clipboard=unnamedplus
        set shell=fish

        let mapleader=' '
        "for wezterm compatibility
        map <C-Left> <C-n>
        map <C-Right> <C-p>

        " Common keybindings

        map <leader>we <Esc><C-w>q<CR>
        map <leader>ww <Esc><Cmd>:Bdelete!<CR>
        map <leader>wc <Esc><Cmd>:bd!<CR>

        imap <c-o> <Esc>o
        imap <c-a> <Esc>a
        imap <c-A> <Esc>A
        imap <c-O> <Esc>O
        imap <c-]> <ESC><ESC>
        nnoremap <c-a> ggVGG



        nnoremap <silent> <ESC> :nohlsearch<CR>
        " nnoremap <esc>^[ <esc>^[
        nnoremap <c><left><left> ^
        nnoremap <c><Right><Right> $


        imap <m-h> <backspace>
        imap <m-=> :=

        vnoremap <TAB> ^
        vnoremap 0 $
        nnoremap <TAB> ^
        nnoremap 0 $


        " Windows navigation
        nnoremap <C-J> <C-W><C-J>
        nnoremap <C-K> <C-W><C-K>
        nnoremap <C-L> <C-W><C-L>
        nnoremap <C-H> <C-W><C-H>
        nnoremap <m-s> :vsplit<CR>
        nnoremap <m-S> :split<CR>


        " Copy to system clipboard
        " noremap <Leader>y "*y
        " noremap <Leader>p "*p
        " noremap <Leader>Y "+y
        " noremap <Leader>P "+p

        " Terminal map
        tnoremap <Esc> <C-\><C-n>
        tnoremap <C-J> <C-\><C-n><C-W><C-J>
        tnoremap <C-K> <C-\><C-n><C-W><C-K>
        tnoremap <C-L> <C-\><C-n><C-W><C-L>
        tnoremap <C-H> <C-\><C-n><C-W><C-H>
        tnoremap <leader>ee <Esc><Cmd>:Bdelete!<CR>
        tnoremap <leader>ew <Esc><Cmd>:bd!<CR>
        autocmd BufWinEnter,WinEnter term://* startinsert

        " https://riptutorial.com/vim/example/16802/search-within-a-function-block#google_vignette
        " for search into function
        vnoremap g/ <ESC>/\%V
        nnoremap ? <vaf><ESC>/\%V

        nnoremap <leader>R @q

        imap <c-o> <CR>
    " general
    set noswapfile
    set wrapscan

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
    " set runtimepath+=$GOROOT/misc/vim
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

    set conceallevel=1
    set ttimeout ttimeoutlen=50

    " highlight the visual selection after pressing enter.
    xnoremap <silent> <cr> "*y:silent! let searchTerm = '\V'.substitute(escape(@*, '\/'), "\n", '\\n', "g") <bar> let @/ = searchTerm <bar> echo '/'.@/ <bar> call histadd("search", searchTerm) <bar> set hls<cr>


    "split | vsplit highlight
    " hi vertsplit guifg=fg guibg=bg
    " hi vertsplit guifg=fg guibg=bg

]])

vim.api.nvim_create_autocmd({ "FileType" }, {
	pattern = "NvimTree",
	callback = function()
		vim.schedule(function()
			vim.keymap.set("n", "q<CR>", ":bd!")
		end)
	end,
})
vim.api.nvim_create_autocmd({ "BufEnter", "BufNewFile" }, {
	pattern = "*.hurl",
	callback = function()
		local buf = vim.api.nvim_get_current_buf()
		vim.api.nvim_buf_set_option(buf, "filetype", "hurl")
	end,
})
vim.keymap.set("n", "[x", function()
	vim.diagnostic.goto_prev({
		severity = vim.diagnostic.severity.ERROR,
	})
end)
vim.keymap.set("n", "]x", function()
	vim.diagnostic.goto_next({
		severity = vim.diagnostic.severity.ERROR,
	})
end)
