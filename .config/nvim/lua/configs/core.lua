local isRussianOn = false

vim.opt.laststatus = 3

vim.cmd([[
        set updatetime=30000
        set relativenumber
        set rnu
        set clipboard=unnamedplus
        set shell=zsh
        let mapleader=' '
        let maplocalleader = ','
        "for wezterm compatibility
        map <C-Left> <C-n>
        map <C-Right> <C-p>

        " Common keybindings

        map <leader>we <Esc><C-w>q<CR>
        map <leader>ww <Esc><Cmd>:Bdelete!<CR>
        map <leader>wc <Esc><Cmd>:bd!<CR>

        imap <c-i> <Esc>o
        " imap <c-O> <Esc>O
        imap <c-l> <Esc>a
        imap <c-h> <Esc>A
        imap <c-]> <ESC><ESC>
        nnoremap <c-a> ggVGG

        nnoremap <silent> <ESC> :nohlsearch<CR>
        " nnoremap <esc>^[ <esc>^[
        nnoremap <c><left><left> ^
        nnoremap <c><Right><Right> $


        imap 0= :=

        vnoremap gh ^
        vnoremap gl $
        nnoremap gh ^
        nnoremap gl $


        " Windows navigation
        nnoremap <C-J> <C-W><C-J>
        nnoremap <C-K> <C-W><C-K>
        nnoremap <C-L> <C-W><C-L>
        nnoremap <C-H> <C-W><C-H>
        nnoremap <leader>ws :vsplit<CR>
        nnoremap <leader>wS :split<CR>


        " Copy to system clipboard
        " noremap <Leader>y "*y
        " noremap <Leader>p "*p
        " noremap <Leader>Y "+y
        " noremap <Leader>P "+p

        " Terminal map
        tnoremap <C-o> <C-\><C-o>
        tnoremap <C-i> <C-\><C-i>
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
        nnoremap ? /\%V
        vnoremap ? <ESC>/\%V

        nnoremap <leader>o :!open <cWORD><CR>
        nnoremap \\ :

        nnoremap ]0 %
        nnoremap [0 %

        " remove line breaking
        " augroup Terminal
        "     autocmd!
        "     autocmd TerminalOpen * execute "set termwinsize=0x" . (winwidth("%")-6)
        "     autocmd VimResized * execute "set termwinsize=0x" . (winwidth("%")-6)
        " augroup END
    " general
    set noswapfile
    set wrapscan


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
		float = false,
	})
end)
vim.keymap.set("n", "]x", function()
	vim.diagnostic.goto_next({
		severity = vim.diagnostic.severity.ERROR,
		float = false,
	})
end)

local function russianToggle()
	if isRussianOn then
		vim.cmd([[set keymap=]])
		isRussianOn = false
	else
		vim.cmd([[set keymap=russian-jcuken]])
		isRussianOn = true
	end
end

vim.keymap.set("n", "M", "J") -- mnemonic: [M]erge
vim.keymap.set("n", "<leader>h", "K") -- mnemonic: [h]over
vim.keymap.set("n", "<c-n>", "<c-i>", { desc = "[N]ext buffer" })
vim.keymap.set("n", "<c-p>", "<c-o>", { desc = "[P]revious buffer" })
vim.keymap.set("n", "<leader>rr", russianToggle, { desc = "[R]ussian", noremap = true })
vim.keymap.set("i", "<c-r>", function()
	vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<esc>", true, false, true), "x", true)
	russianToggle()
	vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("i", true, false, true), "x!", true)
end, {
	desc = "[R]ussian",
	noremap = true,
})
vim.api.nvim_create_autocmd({ "BufEnter", "BufNewFile" }, {
	pattern = "term:*",
	callback = function()
		vim.cmd([[set hidden = true]])
	end,
})
vim.api.nvim_create_autocmd({ "BufEnter", "BufNewFile" }, {
	pattern = "term:*",
	callback = function()
		vim.cmd([[set hidden]])
	end,
})

local api = vim.api
local autocmd = api.nvim_create_autocmd
local augroup = api.nvim_create_augroup
local opt = vim.opt
local o = vim.o
local g = vim.g
local fn = vim.fn

autocmd({ "CursorMoved", "CursorMovedI", "WinScrolled" }, {
	desc = "Fix scrolloff when you are at the EOF",
	group = augroup("ScrollEOF", { clear = true }),
	callback = function()
		if api.nvim_win_get_config(0).relative ~= "" then
			return -- Ignore floating windows
		end

		local win_height = fn.winheight(0)
		local scrolloff = math.min(o.scrolloff, math.floor(win_height / 2))
		local visual_distance_to_eof = win_height - fn.winline()

		if visual_distance_to_eof < scrolloff then
			local win_view = fn.winsaveview()
			fn.winrestview({ topline = win_view.topline + scrolloff - visual_distance_to_eof })
		end
	end,
})

autocmd("FileType", {
	desc = "Automatically Split help Buffers to the right",
	pattern = "help",
	command = "wincmd L",
})

autocmd("BufWritePre", {
	desc = "Autocreate a dir when saving a file",
	group = augroup("auto_create_dir", { clear = true }),
	callback = function(event)
		if event.match:match("^%w%w+:[\\/][\\/]") then
			return
		end
		local file = vim.uv.fs_realpath(event.match) or event.match
		fn.mkdir(fn.fnamemodify(file, ":p:h"), "p")
	end,
})
