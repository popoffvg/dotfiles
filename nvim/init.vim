set relativenumber

set rnu
set clipboard=unnamedplus

let mapleader=' '

let vimplug_exists=expand('~/./autoload/plug.vim')
if has('win32')&&!has('win64')
  let curl_exists=expand('C:\Windows\Sysnative\curl.exe')
else
  let curl_exists=expand('curl')
endif

if !filereadable(vimplug_exists)
  if !executable(curl_exists
    echoerr "You have to install curl or first install vim-plug yourself!"
    execute "q!"
  endif
  echo "Installing Vim-Plug..."
  echo ""
  silent exec "!"curl_exists" -fLo " . shellescape(vimplug_exists) . " --create-dirs https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim"
  filetype off
  let g:not_finish_vimplug = "yes"

  autocmd VimEnter * PlugInstall
endif

" Common keybindings
inoremap jj <Esc>l
map <c-w> <Cmd>:Bdelete<CR>
map <c-W>:bd
imap <a-o> <Esc>o
imap <a-a> <Esc>a
imap <a-O> <Esc>O
imap <a-A> <Esc>A
nnoremap <c-a> ggVGG

nnoremap <esc> :noh<return><esc>
nnoremap <esc>^[ <esc>^[
nnoremap <A-h> ^
nnoremap <A-l> $
nnoremap <A-j> :m .+1<CR>==
nnoremap <A-k> :m .-2<CR>==
nnoremap <c><left><left> ^
nnoremap <c><Right><Right> $

inoremap <A-j> <Esc>:m .+1<CR>==gi
inoremap <A-k> <Esc>:m .-2<CR>==gi
inoremap <A-=> :=

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

call plug#begin(expand('~/./plugged'))
    " Language
    Plug 'neovim/nvim-lspconfig'
	Plug 'hrsh7th/cmp-nvim-lsp'
	Plug 'hrsh7th/cmp-nvim-lua'
	Plug 'hrsh7th/cmp-calc'
	Plug 'hrsh7th/cmp-emoji'
	Plug 'hrsh7th/cmp-buffer'
	Plug 'hrsh7th/cmp-path'
	Plug 'hrsh7th/cmp-cmdline'
    Plug 'hrsh7th/cmp-nvim-lsp-document-symbol'
    Plug 'hrsh7th/cmp-buffer'
	Plug 'hrsh7th/nvim-cmp'
	Plug 'j-hui/fidget.nvim'
	Plug 'L3MON4D3/LuaSnip'
	Plug 'saadparwaiz1/cmp_luasnip'
	Plug 'rafamadriz/friendly-snippets'
	Plug 'ray-x/lsp_signature.nvim'
    Plug 'L3MON4D3/LuaSnip', {'tag': 'v1.1.*'}
    Plug 'rafamadriz/friendly-snippets'
    Plug 'jparise/vim-graphql'

    " Base
    Plug 'akinsho/toggleterm.nvim'
    Plug 'antoinemadec/FixCursorHold.nvim'
    Plug 'sindrets/diffview.nvim'
    Plug 'APZelos/blamer.nvim'
    Plug 'kkharji/sqlite.lua'
    Plug 'mrjones2014/legendary.nvim'

    " Navigation
    Plug 'nvim-tree/nvim-web-devicons' " optional, for file icons
    Plug 'kyazdani42/nvim-tree.lua'
    Plug 'nvim-lua/plenary.nvim'
    Plug 'akinsho/bufferline.nvim', { 'tag': 'v3.*' }
    Plug 'MattesGroeger/vim-bookmarks'
    Plug 'unblevable/quick-scope' 
    Plug 'stevearc/dressing.nvim'

    Plug 'nvim-telescope/telescope.nvim'
    Plug 'nvim-telescope/telescope-fzf-native.nvim', {'do': 'make'}
    Plug 'nvim-telescope/telescope-live-grep-args.nvim'
    Plug 'karb94/neoscroll.nvim'
    Plug 'christoomey/vim-tmux-navigator'
    Plug 'nvim-treesitter/nvim-treesitter-textobjects'
    Plug 'folke/which-key.nvim'
    Plug 'nvim-treesitter/playground'
    Plug 'knubie/vim-kitty-navigator', {'do': 'cp ./*.py ~/.config/kitty/'}
    " Plug 'gnikdroy/projections.nvim'
    Plug 'folke/flash.nvim'
    Plug 'SmiteshP/nvim-navic'
    Plug 'MunifTanjim/nui.nvim'
    Plug 'SmiteshP/nvim-navbuddy'

    " View
    Plug 'nvim-lualine/lualine.nvim'
	Plug 'kyazdani42/nvim-web-devicons'
	Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'}
 	Plug 'lukas-reineke/indent-blankline.nvim'
    Plug 'folke/zen-mode.nvim'
    Plug 'nvim-treesitter/nvim-treesitter'
    Plug 'nvim-treesitter/nvim-treesitter-context'
    Plug 'famiu/bufdelete.nvim'
    function! UpdateRemotePlugins(...)
        " Needed to refresh runtime files
        let &rtp=&rtp
        UpdateRemotePlugins
    endfunction
    Plug 'preservim/vim-colors-pencil'

    Plug 'gelguy/wilder.nvim', { 'do': function('UpdateRemotePlugins') }
    " Plug 'vim-airline/vim-airline'
    Plug 'majutsushi/tagbar'
    Plug 'projekt0n/github-nvim-theme'
    Plug 'SmiteshP/nvim-gps'
    " Plug 'glepnir/dashboard-nvim'
    Plug 'lukas-reineke/indent-blankline.nvim'

	" Git
	Plug 'ThePrimeagen/git-worktree.nvim'
	Plug 'TimUntersberger/neogit'
	Plug 'lewis6991/gitsigns.nvim'
    Plug 'https://github.com/tpope/vim-fugitive.git'
    Plug 'catppuccin/nvim', { 'as': 'catppuccin' }

	" Edit
	Plug 'tpope/vim-surround'
	Plug 'windwp/nvim-autopairs'
    Plug 'arsham/arshlib.nvim'
    Plug 'arsham/yanker.nvim'
    Plug 'mhartington/formatter.nvim'
    " Plug 'jiangmiao/auto-pairs'
	Plug 'numToStr/Comment.nvim'
    Plug '907th/vim-auto-save'
    Plug 'mg979/vim-visual-multi', {'branch': 'master'}
    Plug 'google/vim-maktaba'
    Plug 'google/vim-codefmt'
    " Also add Glaive, which is used to configure codefmt's maktaba flags. See
    " `:help :Glaive` for usage.
    Plug 'google/vim-glaive'
    Plug 'AckslD/nvim-trevJ.lua'
    Plug 'kamykn/spelunker.vim'
    " Plug 'inkarkat/vim-ingo-library' | Plug 'inkarkat/vim-SpellCheck'
    " LSP
    " Plug 'Shougo/deoplete.nvim'
    " Plug 'deoplete-plugins/deoplete-go', { 'do': 'make'}
    Plug 'glepnir/lspsaga.nvim', { 'branch': 'main' }
    Plug 'nvim-treesitter/nvim-treesitter'
    " Plug 'neoclide/coc.nvim', {'branch': 'release'}
    Plug 'mfussenegger/nvim-dap'
    Plug 'leoluz/nvim-dap-go'
    Plug 'rcarriga/nvim-dap-ui'
    Plug 'fgheng/winbar.nvim'
    Plug 'ThePrimeagen/refactoring.nvim'
    Plug 'gbprod/yanky.nvim'

    " Go
    Plug 'meain/vim-jsontogo'   
    Plug 'popoffvg/goimpl.nvim'
    " Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
    " Plug 'ray-x/go.nvim'
    " Plug 'ray-x/guihua.lua' 

    " Plug 'fatih/vim-go', { 'do': ':GoUpdateBinaries' }

    " Others
    Plug 'vim-test/vim-test'
    Plug 'folke/todo-comments.nvim', {'branch': 'neovim-pre-0.8.0'}

call plug#end()

lua << EOF
    require("yanky").setup({
      -- your configuration comes here
      -- or leave it empty to use the default settings
      -- refer
      highlight = {
          on_put = false,
          on_yank = false,
    }})
    vim.keymap.set({"n","x"}, "p", "<Plug>(YankyPutAfter)")
    vim.keymap.set({"n","x"}, "P", "<Plug>(YankyPutBefore)")
    vim.keymap.set({"n","x"}, "gp", "<Plug>(YankyGPutAfter)")
    vim.keymap.set({"n","x"}, "gP", "<Plug>(YankyGPutBefore)")
EOF

lua << EOF
    require "custom.autosave"
    require "custom.autopairs"
    require "custom.lsp"
    require "custom.treesitter"
    require "custom.bufferline"
    require "custom.go"
    require "custom.cmp"
	require "custom.plugins"
    require "custom.telescope"
    require "custom.terminal"
    require "custom.tree"
    require "custom.saga"
    require "custom.comments"
    require "custom.lualine"
    require "custom.go"
    require "custom.luasnippets"
    require "custom.legendary"
    require "custom.startup"
    require "custom.fmt"
    require "custom.zen"
    require "custom.which-key"
    require "custom.wilder"
    require "custom.treesitter_go"
    require "custom.blankline"
EOF
"
"*****************************************************************************
"" Basic Setup
"*****************************************************************************"
" general
set noswapfile 	   

" editing
" How many columns of whitespace a \t is worth
set tabstop=4 " How many columns of whitespace a "level of indentation" is worth
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
colorscheme catppuccin-mocha " catppuccin-latte, catppuccin-frappe, catppuccin-macchiato, catppuccin-mocha catppuccin
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

" kitty nav 
" let g:kitty_navigator_no_mappings = 1
" nnoremap <silent> <a-h> :KittyNavigateLeft<cr>
" nnoremap <silent> <a-j> :KittyNavigateDown<cr>
" nnoremap <silent> <a-k> :KittyNavigateUp<cr>
" nnoremap <silent> <a-l> :KittyNavigateRight<cr>

" highlight the visual selection after pressing enter.
xnoremap <silent> <cr> "*y:silent! let searchTerm = '\V'.substitute(escape(@*, '\/'), "\n", '\\n', "g") <bar> let @/ = searchTerm <bar> echo '/'.@/ <bar> call histadd("search", searchTerm) <bar> set hls<cr>

