<div align="center">

# 💾 State Manager Neo

[![Forge Neo](https://img.shields.io/badge/Forge-Neo-blue)](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.0.2-blueviolet.svg)](#-whats-new)

> **Extension for [Stable Diffusion WebUI Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)**

</div>

> **Save your full txt2img/img2img setup once, and bring it back instantly whenever you need it.**

State Manager Neo lets you snapshot model, sampler, prompts, Hires settings, scripts, and other UI values.

Then restore everything with one click.

---

## 📋 Table of Contents

- [What's New](#-whats-new)
- [Changelog](#-changelog)
- [Roadmap](#-roadmap)
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Credits](#-credits)

---

## 🆕 What's New

### v0.0.2 - Version History UX

- **Config overwrite creates version history** in History

- **History version cards are preview-first** (card click previews, Restore applies)

- **Version list is clearer** with vertical rows and compact summary

- **Schedule Type support** improved in save/restore inspector coverage

### v0.0.1 - Forge Neo Baseline

- Startup stability improvements for extension-heavy setups

- Sampling and batch values fixed in previews

- Negative Prompt capture reliability improved

- Hires CFG Scale and Hires Distilled CFG Scale covered for txt2img/img2img

---

## 📖 Changelog

### v0.0.2

- Save Changes on an existing config archives the previous version into History

- Version entries include version number and short change summary

- History now supports cleaner version browsing and restore flow

- Search and sampler-related mapping coverage were improved

### v0.0.1

- Fixed initialization race issues on Forge Neo

- Fixed undefined preview values in key generation fields

- Added missing Hires CFG fields to capture/restore flow

---

## 🗺️ Roadmap

### v0.0.2 *(complete)* ✅

### v0.1.0 *(planned)*

- Expanded field coverage (Refiner and script-specific values)

- Better metadata options for configs

### v0.2.0 *(planned)*

- Pinned/favorite improvements

- Config import/export

- Better side-by-side comparison tools

---

## 🎯 Features

### Save and Restore

- Save complete txt2img or img2img state in one click

- Restore full config or apply selected fields only

- Works well for frequent style/project switching

### Config Workflow

- Named reusable configs

- Search and filter support

- Startup auto-apply option

- Save Changes flow for iterative edits

### History Workflow

- Version-aware history for configs

- Preview selected version before applying

- Restore exactly the version you want

---

## 📦 Installation

### Inside Forge Neo

1. Open Forge Neo and go to **Extensions**.

2. Click **Install from URL**.

3. Paste:

```text
https://github.com/eduardoabreu81/sd-webui-state-manager-neo
```

4. Click **Install** and reload WebUI.

> ⚠️ This extension is for **Forge Neo**.
>
> For other environments, use the original [sd-webui-state-manager](https://github.com/SenshiSentou/sd-webui-state-manager).

---

## 🚀 Quick Start

1. Set up your generation screen the way you want.

2. Open State Manager.

3. Save a config.

4. Change your UI settings.

5. Re-open the saved config and restore.

---

## 📄 Credits

**[SenshiSentou/sd-webui-state-manager](https://github.com/SenshiSentou/sd-webui-state-manager)**

Original architecture and save/restore foundation.

**[dane-9/sd-webui-state-manager-continued](https://github.com/dane-9/sd-webui-state-manager-continued)**

Continued maintenance before Neo-specific focus.

**[Forge Neo](https://github.com/Haoming02/sd-webui-forge-classic/tree/neo)** by [Haoming02](https://github.com/Haoming02)

---

## 📜 License

MIT - see [LICENSE](LICENSE)

---

[Report Bug](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/issues) • [Request Feature](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/issues) • [Discussions](https://github.com/eduardoabreu81/sd-webui-state-manager-neo/discussions)