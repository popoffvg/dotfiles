local opts = { noremap = true, silent = true }
local keymap = vim.api.nvim_set_keymap


local lga_actions = require("telescope-live-grep-args.actions")
local actions = require('telescope.actions')
require('telescope').setup{
  defaults = {
	initial_mode = "insert",
	file_ignore_patterns = {"node%_modules", "%.git"},
    -- sorting_strategy = "descending",
    -- file_sorter = require("telescope.sorters").get_fuzzy_file,
    -- preview = false,
    layout_config = {
        center = {
            preview_cutoff = 120,
            width = function(_, cols, _)
                if cols > 200 then
                  return 170
                else
                  return math.floor(cols * 0.87)
                end
            end,

            height = function(_, _, max_lines)
                return math.min(max_lines, 80)
            end,
        },
    },
    theme = "dropdown", -- use dropdown theme
  },

   extensions = {
    live_grep_args = {
      auto_quoting = true, -- enable/disable auto-quoting
      -- define mappings, e.g.
      mappings = { -- extend mappings
        i = {
          ["<a-k>"] = lga_actions.quote_prompt(),
          ["<a-f>"] = lga_actions.quote_prompt({ postfix = " --iglob " }),
        },
      },
      theme = "dropdown",
      preview = true,
    },

  },
  pickers = {
        lsp_references = {
            theme = "dropdown",
            show_line = false,
        },
        find_files = {
            preview = false,
        },
    },
}

require('telescope').load_extension("fzf")
require('telescope').load_extension("git_worktree")
require("telescope").load_extension("live_grep_args")
require("telescope").load_extension("live_grep_args")
require("telescope").load_extension("yank_history")

keymap("n", "<leader>ff", ":Telescope find_files hidden=true preview=false<CR>", opts)
keymap("n", "<leader>of", ":Telescope oldfiles<CR>", opts)
-- keymap("n", "<leader>fg", ":Telescope live_grep<CR>", opts)
keymap("n", "<leader>fg", ":lua require('telescope').extensions.live_grep_args.live_grep_args(require('telescope.themes').get_dropdown({}))<CR>", opts)
keymap("n", "<leader>fb", ":Telescope buffers<CR>", opts)
keymap("n", "<leader>fh", ":Telescope help_tags<CR>", opts)
keymap("n", "<leader>ft", ":Telescope treesitter<CR>", opts)
keymap("n", "<leader>fc", ":Telescope commands<CR>", opts)
keymap("n", "<leader>fr", ":Telescope resume<CR>", opts)
keymap("n","<leader>cs", [[:lua require("telescope.builtin").spell_suggest(require("telescope.themes").get_cursor({}))<CR>]],opts)
keymap("n", "<leader>fy", ":Telescope yank_history<CR>", opts)
