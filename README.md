# 💾 State Manager Neo

<div align="center">

[![Forge Neo](https://img.shields.io/badge/Forge-Neo-blue)](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.0.1-blueviolet.svg)](#-whats-new)

> Save and restore full UI states for Stable Diffusion WebUI Forge Neo with one click.

</div>

State Manager Neo lets you capture complete `txt2img` and `img2img` configurations (model, sampler, scripts, settings) and restore them instantly. Perfect for iterative workflows where you need rapid context switching.

## 📋 Table of Contents

• [What's New](#-whats-new)
• [Changelog](#-changelog)
• [Roadmap](#-roadmap)
• [Features](#-features)
• [Installation](#-installation)
• [Architecture](#-architecture)
• [Credits](#-credits)
• [License](#-license)

---

## 🆕 What's New

### v0.0.1 — Forge Neo Baseline

Initial stable release with complete state capture/restore functionality optimized for Forge Neo.

• **Event handler lazy-loading** — component collection deferred to first API call, preventing race conditions with Gradio initialization
• **Preview value fallback** — graceful handling of InputAccordion components and key variant resolution (customscript/ prefix, case variants)
• **Hires CFG Scale capture** — explicit field mapping for all Hires settings including CFG Scale variants, bidirectional resolution in save/apply flows

---

## 📖 Changelog

### v0.0.1 — Forge Neo Baseline

**Infrastructure & Bug Fixes**

• **Lazy-load component collection** — moved from `on_app_started` callback to first API request in `/componentids` endpoint, eliminating "event handler received 0 inputs" errors
• **Fallback value resolution** — enhanced component value extraction with chain: `props.value` → `instance.$$.ctx[0]` → DOM element extraction; handles InputAccordion + customscript components
• **Hires CFG Scale save/restore** — added explicit resolver for component path variants; wired into both `getComponentSettings()` (capture) and `applyComponentSettings()` (restore); added UI fields for txt2img and img2img sections
• **Preview formatter** — improved handling of undefined display values; generates alternative key paths (case, customscript prefix) before failing; shows `-` fallback instead of "undefined"

**Files Modified:** statemanager.ts, javascript/statemanager.js, scripts/api.py

---

## 🗺️ Roadmap

### v0.0.1 — Forge Neo Baseline ✅

• Forge Neo compatibility baseline ✅
• Event handler stability fix ✅
• Component value fallback chain ✅
• Hires settings coverage ✅

### v0.1.0 — Enhanced Coverage (planned)

• Extended field mapping for Refiner settings
• Script-specific state capture
• Custom metadata tagging for configs

### v0.2.0 — UI Polish (planned)

• Favorites / pinned configs
• Config import/export
• Comparison view (diff between states)

### v1.0.0 — First Stable Release (planned)

• Full field coverage for all extension scenarios
• Performance optimization for large config lists
• Comprehensive test suite

---

## 🎯 Features

• **Full state capture** — saves complete txt2img/img2img configurations in one click
• **Instant restore** — apply saved states fully or selectively (cherry-pick fields)
• **History tracking** — revisit previous states (configurable history depth)
• **Reusable configs** — save named configurations for repetitive workflows
• **Quick menu** — fast access to frequently-used configs from toolbar
• **Modal + docked views** — full inspector in modal or compact sidebar panel
• **Smart filtering** — search, sort, filter configs; optional persistent filter state
• **Auto-apply on startup** — designate a config to load automatically when WebUI launches
• **Draft editing** — edit configs with `Save Changes` to preserve live settings
• **Batch operations** — select multiple configs for cleanup/organization
• **IndexedDB persistence** — reliable client-side storage with optional file sync
• **Fallback resolution** — gracefully handles component key variants (case, prefix) and missing values

---

## 📦 Installation

### For Forge Neo

1. Open Stable Diffusion WebUI Forge Neo.
2. Navigate to **Extensions** → **Install from URL**.
3. Paste the repository URL:

```text
https://github.com/eduardoabreu81/sd-webui-state-manager-neo
```

4. Click **Install** and reload the WebUI.

### Requirements

- ✅ [Stable Diffusion WebUI Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
- ✅ Python 3.10+

> ⚠️ **Important**: This extension is optimized exclusively for Forge Neo. It will not work correctly on Automatic1111 or Forge Classic. For other environments, use the original [sd-webui-state-manager](https://github.com/SenshiSentou/sd-webui-state-manager).

---

## 🏗️ Architecture

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | TypeScript (ES2021 target) compiled to JavaScript |
| **Runtime UI** | Gradio components + IndexedDB storage |
| **Styling** | CSS3 (custom theme support) |
| **Backend** | Python FastAPI + Pydantic |
| **Build** | TypeScript compiler (tsc) |

### File Structure

```
statemanager.ts           → Frontend state logic (3900+ lines)
javascript/statemanager.js → Compiled runtime file
style.css                 → UI styling and layout
scripts/api.py            → FastAPI endpoints + Gradio callbacks
docs/PROJECT_LOG.md       → Development log
```

### Key Concepts

- **Lazy-loading** — component collection deferred until first /componentids request
- **Component mapping** — Forge Neo components resolved via multiple fallback strategies
- **Value resolution** — fallback chain for extracting values from Svelte component contexts and DOM
- **Live state synchronization** — real-time UI state capture without blocking interaction

---

## 📄 Credits

### Original Projects — Foundation & Continued Development

This extension builds on exceptional prior work:

**[SenshiSentou/sd-webui-state-manager](https://github.com/SenshiSentou/sd-webui-state-manager)** — Original architecture and core save/restore logic.

**[dane-9/sd-webui-state-manager-continued](https://github.com/dane-9/sd-webui-state-manager-continued)** — Maintenance and improvements before Neo focus.

Please consider starring these repositories to support the original authors.

### Forge Neo Fork — Compatibility & Modern Fixes

[State Manager Neo](https://github.com/eduardoabreu81/sd-webui-state-manager-neo) by [Eduardo Abreu](https://github.com/eduardoabreu81)

• Full compatibility with Forge Neo
• Event handler stability (lazy-loading pattern)
• Hires settings capture expansion
• Component key variant resolution
• Preview formatter fallback chains

### Special Thanks

- [Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo) by [Haoming02](https://github.com/Haoming02) — excellent base for modern Stable Diffusion workflows
- Stable Diffusion community — feedback and bug reports

---

## 📜 License

MIT License. See [LICENSE](LICENSE) for full text.

Made with ❤️ for the Stable Diffusion community.

---

[Report Bug](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/issues) • [Request Feature](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/issues) • [Discussions](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/discussions)