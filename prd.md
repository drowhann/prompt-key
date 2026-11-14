# PRD: PromptKey — GNOME AI Prompt Launcher

## 1. Overview

**Product:** PromptKey  
**Platform:** GNOME Desktop  
**Type:** GNOME Shell Extension  
**Purpose:** Execute reusable AI prompts using global keyboard shortcuts, with optional additional context.

PromptKey allows users to define static prompts, assign shortcuts, configure AI providers, and execute prompts without repeatedly typing the same instructions.

## 2. Core Workflow

1. User presses a global keyboard shortcut.
2. PromptKey opens a prompt window.
3. The associated predefined prompt is automatically selected.
4. User optionally enters additional context in a textarea.
5. User executes the prompt.
6. PromptKey combines the static prompt and additional context.
7. The request is sent to the selected AI provider.
8. The AI response appears in the same window.
9. User can copy the response.

## 3. Prompt Management

Provide the following default prompts:

- Default
- Make Formal
- Check Grammar
- True or False
- Simplify
- Summarize
- Translate
- Explain

Users can:

- Create custom prompts.
- Edit prompts.
- Delete prompts.
- Duplicate prompts.
- Assign keyboard shortcuts.
- Set a default prompt.
- Enable or disable prompts.

Each prompt contains:

- ID
- Name
- Static instruction
- Keyboard shortcut
- Enabled status

## 4. Prompt Window

The prompt window must contain:

- Prompt selector.
- Static prompt preview.
- Additional context textarea.
- Execute button.
- AI provider selector.
- Response display.
- Copy response button.
- Loading and error states.

Requirements:

- Default prompt is selected automatically.
- Dedicated shortcuts preselect their corresponding prompts.
- Additional context is optional.
- Execute using a button or Ctrl+Enter.
- Escape closes the window.
- Response appears without opening another application.
- Copy button copies the response.

## 5. Prompt Composition

Combine the selected static prompt and optional additional context.

Example:

Static prompt:
Rewrite the text in a formal tone.

Additional context:
Keep it concise and suitable for an email.

Final request:

Rewrite the text in a formal tone.

Keep it concise and suitable for an email.

If additional context is empty, execute the static prompt alone.

Do not execute empty requests.

## 6. Keyboard Shortcuts

Use GNOME Shell global keyboard shortcuts.

Suggested defaults:

| Prompt | Shortcut |
|---|---|
| Default | Super + Alt + A |
| Make Formal | Super + Alt + F |
| Check Grammar | Super + Alt + G |
| True or False | Super + Alt + T |
| Simplify | Super + Alt + S |

Requirements:

- Shortcuts must be configurable.
- Each prompt can have its own shortcut.
- A shortcut opens the prompt window with the associated prompt selected.
- Handle shortcut conflicts gracefully.

## 7. AI Provider Configuration

Support multiple AI profiles.

Initial providers:

- Google Gemini
- Groq
- OpenAI
- OpenAI-compatible endpoints

Each AI profile contains:

- ID
- Name
- Provider
- API key
- Endpoint
- Model
- Enabled status

Users can:

- Add profiles.
- Edit profiles.
- Delete profiles.
- Test API connections.
- Select a default profile.
- Switch profiles from the prompt window.
- Configure custom OpenAI-compatible endpoints.

API keys must be stored locally and never logged or transmitted anywhere except their configured AI provider.

## 8. Settings

Provide a preferences interface with:

### Prompts
- Create/edit/delete prompts.
- Assign shortcuts.
- Configure default prompt.

### AI Providers
- Manage AI profiles.
- Configure API keys.
- Configure models and endpoints.
- Test connections.
- Set default AI profile.

### General
- Configure keyboard shortcuts.
- Configure prompt window behavior.

## 9. Technical Stack

- GNOME Shell Extension
- GJS
- JavaScript ESModules
- GNOME Shell St widgets
- GTK4/libadwaita for preferences
- GNOME Extension Settings (GSettings)

Target GNOME Shell 45+ initially.

Use native GNOME extension conventions.

No browser extension APIs.
No Vue/Nuxt.
No backend server.

## 10. Project Structure

```text
prompt-key/
├── metadata.json          # uuid: promptkey@drowhann.github.io
├── extension.js
├── prefs.js
├── stylesheet.css
├── LICENSE                # GPL-2.0-or-later
├── schemas/
├── src/
│   ├── ui/
│   │   └── prompt-window.js
│   ├── prompts/
│   │   └── prompt-manager.js
│   ├── providers/
│   │   ├── provider-manager.js
│   │   ├── gemini.js
│   │   ├── groq.js
│   │   ├── openai.js
│   │   └── openai-compatible.js
│   └── services/
│       ├── storage.js
│       └── prompt-composer.js
└── README.md
```

**Distribution**

- Public repo: https://github.com/drowhann/prompt-key
- Package with `make zip` and submit to https://extensions.gnome.org/upload/
- License must remain GPL-compatible for EGO distribution

Adjust the structure as necessary for GNOME Shell compatibility.

## 11. MVP Acceptance Criteria

- Global shortcuts open PromptKey.
- Each shortcut selects its corresponding prompt.
- Users can create and manage custom prompts.
- Users can enter optional additional context.
- Static prompts and context are composed correctly.
- Users can configure multiple AI profiles.
- Gemini, Groq, OpenAI, and compatible endpoints are supported.
- Users can switch AI profiles.
- AI responses appear in the prompt window.
- Responses can be copied.
- Loading and error states work correctly.
- API keys are stored locally.
- No selection capture or clipboard interaction exists.

## 12. Cursor Implementation Instructions

Implement incrementally:

1. Initialize the GNOME extension.
2. Implement global shortcuts.
3. Build the prompt window.
4. Implement prompt management and storage.
5. Implement prompt composition.
6. Implement AI provider abstraction.
7. Integrate Gemini, Groq, and OpenAI-compatible APIs.
8. Implement multiple AI profiles.
9. Build the preferences interface.
10. Test installation, shortcuts, and API execution.

Prioritize a functional MVP.

Keep the implementation minimal, modular, and maintainable.

Do not add features outside this PRD without explicit approval.
