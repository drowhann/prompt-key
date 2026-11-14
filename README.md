# PromptKey

GNOME Shell extension that runs reusable AI prompts from global keyboard shortcuts.

**License:** [GPL-2.0-or-later](LICENSE)

## Requirements

- GNOME Shell 45+
- Network access for AI providers
- An API key (Gemini, Groq, OpenAI, or an OpenAI-compatible endpoint)

## Install

### From extensions.gnome.org (recommended)

Once published, install from [extensions.gnome.org](https://extensions.gnome.org/) by searching for **PromptKey**, or use GNOME Extensions / Extension Manager.

### From GitHub (no website needed)

You can install without visiting extensions.gnome.org.

**Option A - release zip**

1. Download the latest `.shell-extension.zip` from [Releases](https://github.com/drowhann/prompt-key/releases).
2. Install it:

```bash
gnome-extensions install promptkey@drowhann.github.io.shell-extension.zip
```

3. Enable it (Extensions app, or):

```bash
gnome-extensions enable promptkey@drowhann.github.io
```

4. **Log out and log back in** once (required on Wayland so GNOME Shell discovers the extension).

**Option B - from source**

```bash
git clone https://github.com/drowhann/prompt-key.git
cd prompt-key
./install.sh
```

Then log out and log back in once.

Open settings after login:

```bash
gnome-extensions prefs promptkey@drowhann.github.io
```

Or use **Extensions → PromptKey → Settings**.

If you previously installed the old UUID (`promptkey@promptkey`), remove it first:

```bash
rm -rf ~/.local/share/gnome-shell/extensions/promptkey@promptkey
```

## Usage

Open PromptKey with the global shortcut (default **Super + Alt + A**). First open uses the first enabled prompt; later opens restore the last prompt you selected.

In the prompt window:

- Enter optional extra context
- Switch prompt / AI profile with the selector buttons
- **Ctrl+Enter** to execute
- **Escape** to close
- **Copy response** copies the AI output

## Configure

1. Open preferences (`gnome-extensions prefs promptkey@drowhann.github.io`).
2. Add an AI profile (provider, model, API key, optional base URL for compatible endpoints).
3. Create or edit prompts, and change the open shortcut on the General page if needed.

## Privacy

API keys are stored locally in GSettings and are only sent to the configured provider endpoint. They are never logged.

Clipboard: PromptKey may write the AI response to the clipboard (Copy button, or optional auto-copy). It does not read the clipboard and does not send clipboard data anywhere.

## Development

Contributor and publishing notes live in [docs/development.md](docs/development.md).
