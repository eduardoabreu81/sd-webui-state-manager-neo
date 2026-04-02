import gradio as gr
from fastapi import FastAPI, Body
from pydantic import BaseModel

import json
import hashlib
import sys
import os
from os import path
from typing import Annotated

import modules.script_callbacks as script_callbacks
from modules import shared, scripts

sys.path.insert(0, os.path.dirname(__file__))
from forge_neo_compat import FORGE_NEO_SELECTORS


def is_forge_host() -> bool:
    try:
        import modules_forge  # noqa: F401
        return True
    except ImportError:
        pass

    # Fallback: Forge builds usually expose forge_* options in shared.opts.
    try:
        opts_data = getattr(shared.opts, "data", {}) or {}
        if any(str(key).startswith("forge_") for key in opts_data.keys()):
            return True

        opts_labels = getattr(shared.opts, "data_labels", {}) or {}
        if any(str(key).startswith("forge_") for key in opts_labels.keys()):
            return True
    except Exception:
        pass

    return False


IS_FORGE = is_forge_host()

class ContentsDataModel(BaseModel):
    contents: Annotated[str, Body(embed=True)]

class ModalMessageModel(BaseModel):
    type: str
    contents: str

settings_section = ('statemanager', "State Manager");
script_base_dir = scripts.basedir();
storage_file_path = path.join(script_base_dir, "history.txt")


def update_storage_file_path():
    global storage_file_path

    try:
        storage_file_path = path.join(script_base_dir, shared.opts.statemanager_save_file_location)
    except AttributeError:
        storage_file_path = path.join(script_base_dir, "history.txt")

    with open(storage_file_path, 'a+') as f: # Just make sure it exists, create if not
        pass

# https://stackoverflow.com/questions/22058048/hashing-a-file-in-python
def sha256sum(filepath):
    h  = hashlib.sha256()
    b  = bytearray(128*1024)
    mv = memoryview(b)
    with open(filepath, 'rb', buffering=0) as f:
        while n := f.readinto(mv):
            h.update(mv[:n])
    return h.hexdigest()

def get_quick_settings_names():
    # WebUI variants expose quick settings differently (e.g. quicksettings_list, quicksettings, or opts.data values).
    # Normalize all known shapes into a set of option names.
    quicksettings_raw = getattr(shared.opts, "quicksettings_list", None)

    if quicksettings_raw is None:
        quicksettings_raw = getattr(shared.opts, "quicksettings", None)

    if quicksettings_raw is None and hasattr(shared.opts, "data"):
        quicksettings_raw = shared.opts.data.get("quicksettings_list") or shared.opts.data.get("quicksettings")

    if isinstance(quicksettings_raw, str):
        return {name.strip() for name in quicksettings_raw.split(",") if name.strip()}

    if isinstance(quicksettings_raw, (list, tuple, set)):
        return {str(name).strip() for name in quicksettings_raw if str(name).strip()}

    return set()

def state_manager_api(blocks: gr.Blocks, app: FastAPI):
    """
    Register State Manager API endpoints.
    
    IMPORTANT: On Forge Neo, we do NOT collect or cache component mappings at callback time.
    Instead, we lazy-load them on first API call. This avoids Gradio event handler binding
    issues where handlers try to consume an empty component list before UI initialization completes.
    
    See: github.com/eduardoabreu81/sd-webui-state-manager-neo/issues/2-5
    """
    
    # Lazy-loaded cache to store component mapping on first request
    _cached_component_ids = {'ready': False, 'data': {}}
    
    def _collect_component_ids():
        """Safely collect component IDs from blocks and ui-config, with Forge Neo compatibility."""
        if _cached_component_ids['ready']:
            return _cached_component_ids['data']
        
        try:
            component_ids = {
                component_path: {
                    "id": blocks.ui_loadsave.component_mapping[component_path]._id,
                    "source": "gradio"
                }
                for component_path in blocks.ui_loadsave.component_mapping.keys()
            }
        except Exception as e:
            component_ids = {}
            print(f"[StateManager] WARNING: Failed to collect Gradio component mapping: {e}")

        # Add ui-config fallback entries
        ui_config_path = path.join(scripts.basedir(), "ui-config.json")
        try:
            with open(ui_config_path, 'r', encoding='utf-8') as f:
                ui_config_contents = json.load(f)

            for setting_path in ui_config_contents.keys():
                if not setting_path.endswith("/value"):
                    continue
                if setting_path not in component_ids:
                    component_ids[setting_path] = {
                        "id": None,
                        "source": "ui-config"
                    }
        except Exception as e:
            print(f"[StateManager] WARNING: Failed to load ui-config fallback keys: {e}")

        # Log summary
        gradio_count = sum(1 for v in component_ids.values() if v['source'] == 'gradio')
        uiconfig_count = sum(1 for v in component_ids.values() if v['source'] == 'ui-config')
        print(f"[StateManager] Component resolution: {gradio_count} Gradio + {uiconfig_count} ui-config = {len(component_ids)} total")

        _cached_component_ids['ready'] = True
        _cached_component_ids['data'] = component_ids
        return component_ids

    # Initial log (component collection deferred to first request for Forge Neo compatibility)
    print("[StateManager] API initialized. Component mapping will be collected on first request.")

    @app.get("/statemanager/version")
    async def version():
        return {"version": "0.0.1"}

    @app.get("/statemanager/componentids")
    async def get_component_ids():
        return _collect_component_ids()

    @app.get("/statemanager/debug/components")
    async def get_debug_components():
        try:
            component_keys = list(blocks.ui_loadsave.component_mapping.keys())
            return {"keys": component_keys, "count": len(component_keys)}
        except Exception as e:
            return {"keys": [], "count": 0, "error": str(e)}

    @app.get("/statemanager/forgeneomap")
    async def get_forge_neo_selectors():
        return FORGE_NEO_SELECTORS

    @app.get("/statemanager/uidefaults")
    async def get_ui_defaults():
        filepath = path.join(scripts.basedir(), "ui-config.json")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            contents = json.load(f)
            
            return {
                "hash": sha256sum(filepath),
                "contents": {k: v for (k, v) in contents.items() if k.endswith("/value")} # We don't need /visible, /min, /max, etc.
            }
        
    @app.get("/statemanager/savelocation")
    async def get_save_location():
        return {
            "location": shared.opts.statemanager_save_location,
            "saveFile": shared.opts.statemanager_save_file_location
        }
    
    @app.get("/statemanager/filedata")
    async def get_file_data():
        with open(storage_file_path, 'rb') as f:
            raw = bytearray(f.read())

            return {"data": f"[{','.join(map(str, raw))}]" if len(raw) > 0 else None}

    @app.get("/statemanager/quicksettings")
    async def get_quick_settings():
        # Model, VAE, CLIP and hypernetwork are such important and commonly changed settings, I feel they belong here no matter what
        quick_settings_names = set(['sd_model_checkpoint', 'sd_vae', 'sd_hypernetwork', 'CLIP_stop_at_last_layers']).union(get_quick_settings_names())
        
        return {"settings": {s: getattr(shared.opts, s) for s in quick_settings_names if hasattr(shared.opts, s)}}
    
    @app.post("/statemanager/quicksettings")
    async def set_quick_settings(settings_json: ContentsDataModel):
        settings = json.loads(settings_json.contents)

        for name, value in settings.items():
            if hasattr(shared.opts, name):
                print(f'setting shared.opts.{name} to {value}')
                setattr(shared.opts, name, value)
        
        return {"success": True}

    @app.post("/statemanager/save")
    def save(saveData: ContentsDataModel):
        saveData = bytes(bytearray(map(int, saveData.contents.split(','))))

        with open(storage_file_path, 'wb') as f:
            f.write(saveData)
        
        return {"success": True}
    
    @app.post("/statemanager/showmodal")
    def show_modal(message: ModalMessageModel):
        if message.type == 'info':
            gr.Info(message.contents)
        elif message.type == 'warning':
            gr.Warning(message.contents)
        else:
            gr.Error(message.contents)
        
        return {"success": True}
    
    @app.post("/statemanager/exportlegacy")
    def export_legacy_data(data: ContentsDataModel):
        legacy_file_path = path.join(script_base_dir, "v1_data.json");

        with open(legacy_file_path, 'w') as f:
            f.write(json.dumps(json.loads(data.contents), indent=4))
        
        return {"success": True, "path": legacy_file_path}

def on_ui_settings():
    """Register State Manager UI settings panel on Forge Neo.
    
    Safe registration that handles Forge Neo's timing variations.
    """
    try:
        options = {
            "statemanager_save_explanation": shared.OptionHTML("""
    State Manager 1.0 used to save entries exclusively to the browser's indexed DB. This means each browser - and each browser
    profile - has its own, unique history. Choosing 'File' will instead save the history to a file in this extension's root
    folder, and can be shared across all browsers and profiles.
    """),
            "statemanager_save_location": shared.OptionInfo("Browser's Indexed DB", "Save Location", gr.Radio, {"choices": ["File", "Browser's Indexed DB"]}).needs_reload_ui(),
            "statemanager_save_file_location": shared.OptionInfo("history.txt", "File name", onchange=update_storage_file_path).info("When saving to file, the name of the file to use. Change this is you want to maintain multiple, independent histories. AFTER CHANGING THIS, REMEMBER TO APPLY SETTINGS BEFORE USING ANY OF THE TOOLS BELOW!").needs_reload_ui(),
        }

        for name, opt in options.items():
            opt.section = settings_section
            shared.opts.add_option(name, opt)
    except Exception as e:
        print(f"[StateManager] WARNING: Failed to register UI settings: {e}")

def statemanager_option_button_component(py_click, js_click, **kwargs):
    """Create a button for State Manager options with safe Gradio event handling.
    
    On Forge Neo, we wrap the event binding in error handling to prevent
    empty component list issues during UI initialization.
    """
    class_list = "sd-webui-statemanager-option-button " + kwargs.pop('elem_classes', '')
    button = gr.Button(elem_classes=class_list, **kwargs)

    # Safe event binding with error catching for Forge Neo compatibility
    try:
        if str(gr.__version__[0]) == "3":
            button.click(fn=py_click, _js=js_click)
        else:  # future-proofing
            button.click(fn=py_click, js=js_click)
    except Exception as e:
        # On Forge Neo, .click() may fail if called during UI initialization.
        # This is non-fatal since the button will still work via direct DOM events.
        print(f"[StateManager] Note: Button event binding deferred ({type(e).__name__}). Button will use fallback handlers.")

    return button

class StateManagerOptionButton(shared.OptionInfo):
    def __init__(self, text, py_click, js_click, **kwargs):
        super().__init__(str(text).strip(), label='', component=lambda **lkwargs: statemanager_option_button_component(py_click, js_click, **{**kwargs, **lkwargs}))
        self.do_not_save = True

if not IS_FORGE:
    print("[StateManager] WARNING: This extension requires sd-webui-forge-classic (neo). Skipping registration.")
else:
    shared.options_templates.update(
        shared.options_section(
            settings_section, {
                "statemanager_idb2file_overwrite": StateManagerOptionButton('Copy Indexed DB to File (overwrite)', None, "stateManager.syncStorage('idb2file', 'overwrite')", variant="primary"),
                "statemanager_idb2file_merge": StateManagerOptionButton('Copy Indexed DB to File (merge)', None, "stateManager.syncStorage('idb2file', 'merge')", variant="primary"),
                "statemanager_file2idb_overwrite": StateManagerOptionButton('Copy File to Indexed DB (overwrite)', None, "stateManager.syncStorage('file2idb', 'overwrite')", variant="primary"),
                "statemanager_file2idb_merge": StateManagerOptionButton('Copy File to Indexed DB (merge)', None, "stateManager.syncStorage('file2idb', 'merge')", variant="primary"),
                "statemanager_idb_clear": StateManagerOptionButton('Delete all data from Indexed DB', None, "stateManager.clearData('Browser\\'s Indexed DB')"),
                "statemanager_file_clear": StateManagerOptionButton('Delete all data from File', None, "stateManager.clearData('File')"),
            }
        )
    )

    update_storage_file_path()

    script_callbacks.on_app_started(state_manager_api)
    script_callbacks.on_ui_settings(on_ui_settings)
