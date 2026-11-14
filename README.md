# PromptKey

GNOME Shell extension that runs reusable AI prompts from global keyboard shortcuts.

**UUID:** `promptkey@drowhann.github.io`  
**Repo:** https://github.com/drowhann/prompt-key  
**License:** [GPL-2.0-or-later](LICENSE)

## Requirements

- GNOME Shell 45+
- Network access for AI providers
- An API key (Gemini, Groq, OpenAI, or an OpenAI-compatible endpoint)

## Install

### From extensions.gnome.org (recommended)

Once published, install from [extensions.gnome.org](https://extensions.gnome.org/) by searching for **PromptKey**, or use GNOME Extensions / Extension Manager.

### From source

```bash
./install.sh
```

Then **log out and log back in** once (required on Wayland so GNOME Shell discovers the new extension).

Open settings after login:

```bash
gnome-extensions prefs promptkey@drowhann.github.io
```

Or use **Extensions → PromptKey → Settings**.

If you previously installed the old UUID (`promptkey@promptkey`), remove it first:

```bash
make uninstall
```

### Package a zip for upload

```bash
make zip
```

This builds `promptkey@drowhann.github.io.shell-extension.zip` for [extensions.gnome.org/upload](https://extensions.gnome.org/upload/).

## Usage

| Prompt | Shortcut |
|---|---|
| Default | Super + Alt + A |
| Make Formal | Super + Alt + F |
| Check Grammar | Super + Alt + G |
| True or False | Super + Alt + T |
| Simplify | Super + Alt + S |

Open PromptKey with the global open shortcut (default **Super + Alt + A**), or with a prompt-specific shortcut.

In the prompt window:

- Enter optional extra context
- Switch prompt / AI profile with the selector buttons
- **Ctrl+Enter** to execute
- **Escape** to close
- **Copy response** copies the AI output

## Configure

1. Open preferences (`gnome-extensions prefs promptkey@drowhann.github.io`).
2. Add an AI profile (provider, model, API key, optional base URL for compatible endpoints).
3. Create or edit prompts and assign shortcuts as needed.

## Privacy

API keys are stored locally in GSettings and are only sent to the configured provider endpoint. They are never logged.

## Development

```bash
make install   # sync into ~/.local/share/gnome-shell/extensions/
make reload    # re-enable; on Wayland, log out/in for JS changes
make prefs     # open preferences
make status    # extension info
make zip       # build upload zip
```

See [prd.md](prd.md) for product scope and acceptance criteria.

## Publishing

1. `make zip`
2. Upload the zip at https://extensions.gnome.org/upload/
3. Wait for review; fix any review comments and re-upload
