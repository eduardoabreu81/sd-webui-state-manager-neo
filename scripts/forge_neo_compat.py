"""
Forge Neo DOM selector map for critical components.

Provides explicit CSS selectors as fallback for components that cannot be 
resolved through either blocks.ui_loadsave.component_mapping or ui-config.json.

Paths are component paths without the trailing /value setting attribute.
Container IDs also let the frontend recover live Gradio components when the
backend only knows their ui-config aliases.
"""

FORGE_NEO_SELECTORS = {
    # txt2img generation settings
    "txt2img/Sampling steps":            "#txt2img_steps",
    "txt2img/CFG Scale":                 "#txt2img_cfg_scale",
    "txt2img/Sampling method":           "#txt2img_sampling",
    "txt2img/Schedule type":             "#txt2img_scheduler",

    # img2img generation settings
    "img2img/Denoising strength":        "#img2img_denoising_strength",
    "img2img/Sampling steps":            "#img2img_steps",
    "img2img/CFG Scale":                 "#img2img_cfg_scale",
    "img2img/Sampling method":           "#img2img_sampling",
    "img2img/Schedule type":             "#img2img_scheduler",

    # Forge's sampler script registers these independently of the direct paths.
    "customscript/sampler.py/txt2img/Sampling Method": "#txt2img_sampling",
    "customscript/sampler.py/txt2img/Sampling Steps":  "#txt2img_steps",
    "customscript/sampler.py/txt2img/Schedule Type":   "#txt2img_scheduler",
    "customscript/sampler.py/img2img/Sampling Method": "#img2img_sampling",
    "customscript/sampler.py/img2img/Sampling Steps":  "#img2img_steps",
    "customscript/sampler.py/img2img/Schedule Type":   "#img2img_scheduler",

    # Forge Neo 2.31 drops these from component_mapping via no_config(), and the label
    # fallback misses them on a localized UI (ko_KR shows "너비" for Width) -> size was never saved
    "txt2img/Width":                     "#txt2img_width",
    "txt2img/Height":                    "#txt2img_height",
    "txt2img/Distilled CFG Scale":       "#txt2img_distilled_cfg_scale",
    "txt2img/Hires steps":               "#txt2img_hires_steps",
    "txt2img/Hires CFG Scale":           "#txt2img_hr_cfg",
    "txt2img/Hires Distilled CFG Scale": "#txt2img_hr_distilled_cfg",
    "img2img/Width":                     "#img2img_width",
    "img2img/Height":                    "#img2img_height",
    "img2img/Distilled CFG Scale":       "#img2img_distilled_cfg_scale",
}
