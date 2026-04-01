"""
Forge Neo DOM selector map for critical components.

Provides explicit CSS selectors as fallback for components that cannot be 
resolved through either blocks.ui_loadsave.component_mapping or ui-config.json.

Used when both Gradio component ID and ui-config DOM query mechanisms fail.
"""

FORGE_NEO_SELECTORS = {
    # txt2img generation settings
    "txt2img/Sampling steps/value":       "#txt2img_steps input",
    "txt2img/CFG Scale/value":            "#txt2img_cfg_scale input",
    "txt2img/Sampling method/value":      "#txt2img_sampling",
    "txt2img/Schedule type/value":        "#txt2img_scheduler",

    # img2img generation settings
    "img2img/Denoising strength/value":   "#img2img_denoising_strength input",
    "img2img/Sampling steps/value":       "#img2img_steps input",
    "img2img/CFG Scale/value":            "#img2img_cfg_scale input",
}
