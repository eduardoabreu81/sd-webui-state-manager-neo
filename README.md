<div align="center">

# 💾 State Manager Neo

[![Forge Neo](https://img.shields.io/badge/Forge-Neo-blue)](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.0.1-blueviolet.svg)](#-whats-new)

> **Extension for [Stable Diffusion WebUI Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)**

</div>

> **Tired of reconfiguring everything from scratch every time you switch projects or styles? Save your entire UI state with one click and bring it back instantly.**

State Manager Neo lets you snapshot your full `txt2img` and `img2img` setup — model, sampler, prompt, Hires settings, scripts, extensions — and restore it anytime, exactly as you left it.

---

## 📋 Table of Contents

- [What's New](#-whats-new)
- [Changelog](#-changelog)
- [Roadmap](#️-roadmap)
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Credits](#-credits)

---

## 🆕 What's New

### v0.0.1 — Forge Neo Baseline

First stable release, built exclusively for Forge Neo.

- **Startup stability** — Fixed initialization errors that appeared on some setups with many extensions loaded
- **Sampling & Batches** — These fields now display correctly in the state preview instead of showing "undefined"
- **Negative Prompt** — Now captured reliably in all Forge Neo layouts
- **Hires CFG Scale** — Added to the Hires. fix section for both `txt2img` and `img2img`
- **Hires Distilled CFG Scale** — Also captured and restored correctly

> Full details in the Changelog below.

---

## 📖 Changelog

### v0.0.1 — Forge Neo Baseline

- Fixed startup error: event handlers no longer fail to load when Forge Neo initializes with many extensions active
- Fixed preview showing "undefined" for Sampling Method, Sampling Steps, Batch Count, Batch Size, and Negative Prompt
- Added Hires CFG Scale and Hires Distilled CFG Scale to saved state, for both txt2img and img2img
- Improved value reading for Forge Neo's custom accordion components (Negative Prompt, script fields)
- All existing saved state files remain fully compatible — no migration needed

---

## 🗺️ Roadmap

### v0.0.1 — Forge Neo Baseline *(complete)* ✅

### v0.1.0 — Expanded Field Coverage *(planned)*
- Refiner settings capture
- Script-specific state fields
- Custom metadata tags for configs

### v0.2.0 — UI Polish *(planned)*
- Pinned / favorite configs
- Config import and export
- Side-by-side diff view between two states

---

## 🎯 Features

### 💾 Save & Restore
- Save your complete `txt2img` or `img2img` setup with one click ⭐
- Restore any saved state fully, or pick only the fields you want
- Covers model, sampler, steps, CFG, Hires settings, prompts, scripts, and loaded extensions

### 📁 Config Management
- Name and organize your configs freely
- Filter and search through your saved configs
- Set a config to load automatically when the WebUI starts

### 🕓 History
- Each config keeps its own version history
- Revisit and restore any previous version of a config

### 🖥️ Flexible UI
- Open as a floating modal or docked panel
- Quick-access toolbar for your most-used configs
- Edit and update configs without losing your live settings

---

## 📦 Installation

### Inside SD WebUI (Recommended)

1. Open Forge Neo and go to the **Extensions** tab.
2. Click **Install from URL**.
3. Paste:

```
https://github.com/eduardoabreu81/sd-webui-state-manager-neo
```

4. Click **Install** and reload the WebUI.

> ⚠️ This extension works exclusively with **Forge Neo**. It will not work correctly on AUTOMATIC1111 or Forge Classic. For those environments, use the original [sd-webui-state-manager](https://github.com/SenshiSentou/sd-webui-state-manager).

---

## 🚀 Quick Start

1. Configure your `txt2img` the way you want — model, sampler, prompt, Hires settings, everything.
2. Open the **State Manager** panel.
3. Click **Save** and give your config a name.
4. Change anything in the UI.
5. Come back to State Manager, select your config, and click **Load** — everything is restored instantly.

---

## 📄 Credits

**[SenshiSentou/sd-webui-state-manager](https://github.com/SenshiSentou/sd-webui-state-manager)** — Original extension, core architecture and save/restore logic.

**[dane-9/sd-webui-state-manager-continued](https://github.com/dane-9/sd-webui-state-manager-continued)** — Continued maintenance and the base for this fork.

Please consider starring both repositories to support the original authors.

**[Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)** by [Haoming02](https://github.com/Haoming02) — The WebUI this extension is built for.

---

## 📜 License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Made with ❤️ for the Stable Diffusion community

**[Report Bug](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/issues)** • **[Request Feature](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/issues)** • **[Discussions](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/discussions)**

</div>
