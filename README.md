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

Clipboard: PromptKey may write the AI response to the clipboard (Copy button, or optional auto-copy). It does not read the clipboard and does not send clipboard data anywhere.

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

### One-time setup (GitHub Actions → EGO)

1. Create an account at https://extensions.gnome.org/ (username + password; OAuth-only may not work for the API).
2. In the GitHub repo: **Settings → Secrets and variables → Actions**, add:
   - `EGO_USERNAME` - your EGO username
   - `EGO_PASSWORD` - your EGO password
3. Push these workflow files to `main`, then release with a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

That runs [.github/workflows/release.yml](.github/workflows/release.yml): builds the zip, creates a GitHub Release, and uploads to EGO via [scripts/ego-upload.sh](scripts/ego-upload.sh).

You can also run the workflow manually: **Actions → Release → Run workflow**.

EGO still reviews each upload by hand. Screenshots are added on your extension page after the first listing exists.

### Manual upload

```bash
make zip
# then https://extensions.gnome.org/upload/
```
