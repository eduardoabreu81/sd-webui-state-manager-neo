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
}
