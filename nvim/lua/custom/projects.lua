 require("projections").setup({
            workspaces = { "~/Документы/МТС/git" },                    -- Default workspaces to search for
            patterns = { ".git", ".svn", ".hg" },        -- Patterns to search for, these are NOT regexp
            store_hooks = { pre = nil, post = nil },     -- pre and post hooks for store_session, callable | nil
            restore_hooks = { pre = nil, post = nil },   -- pre and post hooks for restore_session, callable | nil
        })
