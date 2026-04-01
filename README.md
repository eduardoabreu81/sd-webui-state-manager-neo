# State Manager Neo

<div align="center">

[![Forge Neo](https://img.shields.io/badge/Forge-Neo-blue)](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> State manager extension for Stable Diffusion WebUI Forge Neo.

</div>

> This is a fork focused exclusively on Forge Neo compatibility.

State Manager Neo lets you save and restore full `txt2img` and `img2img` UI states, so you can return to known-good setups in one click.

If you frequently switch models, samplers, scripts, and generation settings, this extension gives you repeatable state management with reusable configs, history browsing, and fast apply flows.

<img width="270" alt="preview-modal" src="https://github.com/user-attachments/assets/eabca34a-0229-46ca-b544-ee9efe88d3b9" /> <img width="270" alt="preview-small" src="https://github.com/user-attachments/assets/e37a78f9-8517-4097-834f-731049236871" /> <img width="270" alt="preview-quick" src="https://github.com/user-attachments/assets/eff429c2-ec3e-4590-ba2e-6eb6d23cff45" />

## Compatibility

- Supported: [Stable Diffusion WebUI Forge Classic - neo branch](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
- Scope: Forge Neo only
- Note: Config files may not be compatible with non-Neo variants

## Features

- Full state save/restore for `txt2img` and `img2img`
- History + reusable Configs with partial or full apply
- Modal view, docked small view, and quick config menu
- Collapsible small view with persistent state
- Draft-based config editing with `Save Changes`
- Config duplication flow (`Save as Config`)
- Manual config reorder reflected in quick menu
- Search, filter, sort, and optional filter persistence
- Startup Config auto-apply on launch
- Dedicated Settings tab with IndexedDB persistence
- Batch-friendly management (select, save/unsave, delete, rename)

## Installation

### For Forge Neo

1. Open Forge Neo WebUI.
2. Go to Extensions -> Install from URL.
3. Paste:

```text
https://github.com/eduardoabreu81/sd-webui-state-manager-neo
```

4. Click Install.
5. Reload/restart WebUI.

### Requirements

- [Stable Diffusion WebUI Forge Classic - neo branch](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
- Python 3.10+

## Credits

This project is built on top of the original work from:

- [SenshiSentou/sd-webui-state-manager](https://github.com/SenshiSentou/sd-webui-state-manager)
- [dane-9/sd-webui-state-manager-continued](https://github.com/dane-9/sd-webui-state-manager-continued)

Please consider starring the original repositories.

## License

MIT License. See [LICENSE](LICENSE).