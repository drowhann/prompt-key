UUID := promptkey@promptkey

.PHONY: install reload uninstall prefs status test-compose test-groq test-mvp

install:
	./install.sh

reload:
	./reload.sh

uninstall:
	rm -rf "$(HOME)/.local/share/gnome-shell/extensions/$(UUID)"

prefs:
	gnome-extensions prefs $(UUID)

status:
	gnome-extensions info $(UUID) || true

test-compose:
	gjs -m scripts/test-compose.js

test-groq:
	gjs -m scripts/test-groq.js

test-mvp:
	GSETTINGS_SCHEMA_DIR="$(HOME)/.local/share/gnome-shell/extensions/$(UUID)/schemas" gjs -m scripts/test-mvp.js
