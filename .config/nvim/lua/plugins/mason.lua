return {
	"williamboman/mason.nvim",
	config = function()
		require("mason").setup({
			ui = {
				-- Whether to automatically check for new versions when opening the :Mason window.
				check_outdated_packages_on_open = false,
				border = "single",
				icons = {
					package_pending = " ",
					package_installed = " ",
					package_uninstalled = " ",
				},
			},
		})
	end,
}
