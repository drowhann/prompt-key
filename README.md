# PromptKey

GNOME Shell extension that runs reusable AI prompts from global keyboard shortcuts.

## Requirements

- GNOME Shell 45+
- Network access for AI providers
- An API key (Gemini, Groq, OpenAI, or an OpenAI-compatible endpoint)

## Install

```bash
./install.sh
```

Then **log out and log back in** once (required on Wayland so GNOME Shell discovers the new extension).

Open settings after login:

```bash
gnome-extensions prefs promptkey@promptkey
```

Or use **Extensions → PromptKey → Settings**.

## Usage

| Prompt | Shortcut |
|---|---|
| Default | Super + Alt + A |
| Make Formal | Super + Alt + F |
| Check Grammar | Super + Alt + G |
| True or False | Super + Alt + T |
| Simplify | Super + Alt + S |

In the prompt window:

- Enter optional extra context
- Switch prompt / AI profile with the selector buttons
- **Ctrl+Enter** to execute
- **Escape** to close
- **Copy response** copies the AI output

## Privacy

API keys are stored locally in GSettings and are only sent to the configured provider endpoint. They are never logged.
