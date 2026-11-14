UUID := promptkey@drowhann.github.io
ZIP := $(UUID).shell-extension.zip

.PHONY: install reload uninstall prefs status zip test-compose test-groq test-mvp

install:
	./install.sh

reload:
	./reload.sh

uninstall:
	rm -rf "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)"
	rm -rf "$(HOME)/.local/share/gnome-shell/extensions/promptkey@promptkey"

prefs:
	gnome-extensions prefs $(UUID)

status:
	gnome-extensions info $(UUID) || true

zip:
	glib-compile-schemas schemas
	rm -f $(ZIP)
	zip -r $(ZIP) \
		extension.js \
		prefs.js \
		stylesheet.css \
		metadata.json \
		schemas/org.gnome.shell.extensions.promptkey.gschema.xml \
		schemas/gschemas.compiled \
		src \
		LICENSE \
		-x '*.git*' '*~' '*.swp'
	@echo "Built $(ZIP)"
	@unzip -l $(ZIP) | head -40

test-compose:
	gjs -m scripts/test-compose.js

test-groq:
	gjs -m scripts/test-groq.js

test-mvp:
	GSETTINGS_SCHEMA_DIR="$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas" gjs -m scripts/test-mvp.js
