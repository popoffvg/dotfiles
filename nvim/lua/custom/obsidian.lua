vim.cmd[[
    let g:vimsidian_path = '~/Dropbox/Z-Core/Z-Core'
    let g:vimsidian_enable_complete_functions = 1
    let g:vimsidian_complete_paths = [g:vimsidian_path]
    let $VIMSIDIAN_PATH_PATTERN = g:vimsidian_path . '/*.md'


    function! s:vimsidianNewNoteAtNotesDirectory()
      execute ':VimsidianNewNote ' . g:vimsidian_path 
    endfunction

    augroup vimsidian_augroup
      au!
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nl :VimsidianFdLinkedNotesByThisNote<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> ng :VimsidianRgNotesLinkingThisNote<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nm :VimsidianRgNotesWithMatchesInteractive<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> ni :VimsidianRgLinesWithMatchesInteractive<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nt :VimsidianRgTagMatches<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> <C-k> :VimsidianMoveToLink<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> <2-LeftMouse> :VimsidianMoveToLink<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nk :VimsidianMoveToPreviousLink<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nj :VimsidianMoveToNextLink<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nN :call <SID>vimsidianNewNoteAtNotesDirectory()<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nO :VimsidianNewNoteInteractive<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nd :VimsidianDailyNote<CR>
      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN nn <buffer> nf :VimsidianFormatLink<CR>
      au WinEnter,BufEnter $VIMSIDIAN_PATH_PATTERN silent! call vimsidian#MatchBrokenLinks()
      au CursorMoved $VIMSIDIAN_PATH_PATTERN silent! call vimsidian#MatchCursorLink()

      au BufNewFile,BufReadPost $VIMSIDIAN_PATH_PATTERN setlocal completefunc=vimsidian#CompleteNotes
    augroup END
]]
