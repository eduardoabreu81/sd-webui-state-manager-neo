const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { gzipSync } = require('node:zlib');

// Exercise the shipped runtime. Only the host's DOM/Gradio/API boundaries are faked.
const runtime = fs.readFileSync(require('node:path').join(__dirname, '../javascript/statemanager.js'), 'utf8');
const selectors = JSON.parse(execFileSync('python', ['-c',
    'import json, runpy; print(json.dumps(runpy.run_path("scripts/forge_neo_compat.py")["FORGE_NEO_SELECTORS"]))'
], { encoding: 'utf8' }));

class Input extends EventTarget {
    constructor(type, value) {
        super();
        this.type = type;
        this.value = `${value}`;
        this.id = '';
    }
}
class Select extends EventTarget {}
class Textarea extends EventTarget {}

function host() {
    const elements = new Map();
    const request = {};
    const document = {
        getElementById: id => elements.get(id) || null,
        querySelector: selector => elements.get(selector.replace(/^#/, '')) || null,
        querySelectorAll: () => []
    };
    const components = [];
    const window = { indexedDB: { open: () => request }, setTimeout: () => 1, components };
    vm.runInNewContext(runtime, {
        window, document, gradioApp: () => document,
        gradio_config: { components }, uiCurrentTab: { innerText: 'txt2img' }, onUiLoaded() {}, onAfterUiUpdate() {},
        HTMLInputElement: Input, HTMLSelectElement: Select, HTMLTextAreaElement: Textarea,
        AbortController, Event, Response, Uint8Array, Blob, CompressionStream, DecompressionStream, TextDecoder,
        setTimeout: () => 1, clearTimeout() {}, alert() {}, console: { log() {}, warn() {}, error() {} }
    });
    const sm = window.stateManager;
    sm.forgeNeoSelectorMap = selectors;
    return { sm, elements, window, request, document };
}

function wrapper(id, input) {
    return { id, querySelector: selector => selector.includes(`input[type="${input.type}"]`) ? input : null };
}

for (const type of ['txt2img', 'img2img']) {
    test(`${type}: sampler aliases capture and restore through live Gradio controls`, async () => {
        const { sm, elements, window } = host();
        const fields = [['Sampling Method', 'sampling', 'Euler', 'DPM++ 2M'],
            ['Sampling Steps', 'steps', 20, 35], ['Schedule Type', 'scheduler', 'Automatic', 'Karras']];
        const components = fields.map(([, suffix, initial], id) => ({
            id, props: { elem_id: `${type}_${suffix}`, value: initial },
            instance: { $set() {} }
        }));
        // The real UI supplies component instances in gradio_config.
        const response = {};
        const defaults = {};
        for (const [label, suffix, initial] of fields) {
            const element = new EventTarget();
            element.id = `${type}_${suffix}`;
            elements.set(element.id, element);
            for (const path of [`${type}/${label}`, `customscript/sampler.py/${type}/${label}`]) {
                response[`${path}/value`] = { id: null, source: 'ui-config' };
                defaults[path] = initial;
            }
        }
        sm.api.get = async () => response;
        // Set the host config in the same VM in which the extension runs.
        // buildComponentMap closes over this object, exposed by the host fixture below.
        window.components.push(...components);
        await sm.buildComponentMap();
        sm.memoryStorage.currentDefault = { hash: 'fixture', contents: defaults };
        sm.applyComponentSettings(Object.fromEntries(fields.map(([label, , , value]) => [`${type}/${label}`, value])));
        const captured = sm.getComponentSettings(type, false);
        assert.equal(captured[`${type}/Sampling Method`], 'DPM++ 2M');
        assert.equal(captured[`customscript/sampler.py/${type}/Sampling Steps`], 35);
        assert.equal(captured[`${type}/Schedule Type`], 'Karras');
    });
}

test('nested numeric inputs are read and restored, with events on the input', () => {
    const { sm, elements } = host();
    const input = new Input('number', 35);
    elements.set('txt2img_steps', wrapper('txt2img_steps', input));
    const events = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    const entry = { source: 'ui-config', path: 'txt2img/Sampling Steps' };
    assert.equal(sm.getMappedComponentEntryValue(entry), 35);
    sm.setMappedComponentEntryValue(entry, 42);
    assert.equal(input.value, '42');
    assert.deepEqual(events, ['input', 'change']);
});

for (const [path, id, value] of [
    ['txt2img/CFG Scale', 'txt2img_cfg_scale', 7],
    ['img2img/CFG Scale/value', 'img2img_cfg_scale', 5],
    ['img2img/Denoising strength', 'img2img_denoising_strength', 0.65]
]) {
    test(`explicit fallback still covers ${path}`, () => {
        const { sm, elements } = host();
        elements.set(id, wrapper(id, new Input('number', value)));
        assert.equal(sm.getMappedComponentEntryValue({ source: 'ui-config', path }), value);
    });
}

for (const format of ['typed', 'array', 'json', 'csv']) {
    test(`loads ${format} gzip storage without losing entries`, async () => {
        const { sm } = host();
        const bytes = gzipSync(JSON.stringify({ defaults: {}, entries: { 123: { name: 'Keep me' } } }));
        const payload = format === 'typed' ? new Uint8Array(bytes) : format === 'array' ? [...bytes]
            : format === 'json' ? JSON.stringify([...bytes]) : [...bytes].join(',');
        const decoded = await sm.processStorageData(payload);
        assert.equal(decoded.entries['123'].name, 'Keep me');
    });
}

test('invalid byte values are rejected rather than converted or silently reset', async () => {
    const { sm } = host();
    await assert.rejects(sm.processStorageData([256, -1]), /byte/i);
});

test('storage completion waits for the IndexedDB transaction', async () => {
    const { sm, request } = host();
    const transaction = { objectStore: () => ({ put() {} }), commit() {} };
    request.onsuccess.call({ result: { transaction: () => transaction } });
    sm.api.get = async () => ({ location: "Browser's Indexed DB" });
    sm.getCompressedMemoryStorage = async () => new Uint8Array([1, 2, 3]);
    let finished = false;
    const saving = sm.updateStorage().then(() => { finished = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, false);
    transaction.oncomplete();
    await saving;
    assert.equal(finished, true);
});

test('file storage does not report success when the backend rejects the write', async () => {
    const { sm } = host();
    sm.api.get = async () => ({ location: 'File' });
    sm.api.post = async () => ({ success: false });
    sm.getCompressedMemoryStorage = async () => new Uint8Array([1]);
    await assert.rejects(sm.updateStorage());
});

test('capture reports incomplete initialization explicitly', async () => {
    const { sm } = host();
    await assert.rejects(sm.getCurrentState('txt2img'), /ready|loaded|initializ/i);
});

test('a named quick config is only reported saved after successful persistence', { timeout: 2000 }, async () => {
    const { sm } = host();
    sm.componentMapReady = true;
    sm.memoryStorage.currentDefault = { hash: 'fixture', contents: {} };
    sm.memoryStorage.savedDefaults = {};
    sm.api.get = async endpoint => endpoint === 'quicksettings' ? { settings: {} } : { location: 'File' };
    let release;
    let payload;
    let writeStarted;
    let writeFailed;
    const started = new Promise((resolve, reject) => { writeStarted = resolve; writeFailed = reject; });
    sm.api.post = async (endpoint, body) => {
        assert.equal(endpoint, 'save');
        payload = body.contents;
        return new Promise(resolve => { release = resolve; writeStarted(); });
    };
    let finished = false;
    const saving = sm.saveCurrentUIConfig('  My portrait  ').then(state => { finished = true; return state; });
    saving.catch(writeFailed);
    await started;
    assert.equal(finished, false);
    assert.equal(sm.isSavingCurrentConfig, true);
    release({ success: true });
    const saved = await saving;
    assert.equal(saved.name, 'My portrait');
    assert.equal(saved.groups[0], 'favourites');
    const stored = JSON.parse(require('node:zlib').gunzipSync(Buffer.from(payload.split(',').map(Number))));
    assert.equal(stored.entries[saved.createdAt].name, 'My portrait');
    assert.equal(sm.isSavingCurrentConfig, false);
});

test('failed quick saves remove their provisional entry and allow retry', async () => {
    const { sm } = host();
    sm.componentMapReady = true;
    sm.memoryStorage.currentDefault = { hash: 'fixture', contents: {} };
    sm.memoryStorage.savedDefaults = {};
    const existing = { createdAt: 1, name: 'Existing config', groups: ['favourites'] };
    sm.memoryStorage.entries.data[1] = existing;
    sm.memoryStorage.favouritesOrder = ['1'];
    sm.api.get = async endpoint => endpoint === 'quicksettings' ? { settings: {} } : { location: 'File' };
    sm.api.post = async () => ({ success: false });
    await assert.rejects(sm.saveCurrentUIConfig('Keep my name'));
    assert.equal(Object.keys(sm.memoryStorage.entries.data).length, 1);
    assert.equal(sm.memoryStorage.entries.data[1], existing);
    assert.equal(sm.memoryStorage.favouritesOrder.join(','), '1');
    assert.equal(sm.isSavingCurrentConfig, false);
});

test('quick configs reject incomplete quicksettings instead of saving a partial setup', async () => {
    const { sm } = host();
    sm.componentMapReady = true;
    sm.memoryStorage.currentDefault = { hash: 'fixture', contents: {} };
    sm.memoryStorage.savedDefaults = {};
    sm.api.get = async endpoint => endpoint === 'quicksettings' ? { error: 'Unavailable' } : { location: 'File' };
    sm.api.post = async () => ({ success: true });
    await assert.rejects(sm.saveCurrentUIConfig('Portrait'));
    assert.equal(Object.keys(sm.memoryStorage.entries.data).length, 0);
});

test('editing a config still archives its previous version automatically', async () => {
    const { sm } = host();
    const path = 'txt2img/Sampling Steps';
    const previous = { createdAt: 1, type: 'txt2img', name: 'Portrait', groups: ['favourites'],
        defaults: 'fixture', quickSettings: {}, componentSettings: { [path]: 20 } };
    sm.componentMapReady = true;
    sm.memoryStorage.currentDefault = { hash: 'fixture', contents: { [path]: 20 } };
    sm.memoryStorage.entries.data[1] = previous;
    sm.componentMap[path] = { entries: [{ source: 'gradio', component: { props: { value: 35 } } }] };
    sm.selection.entries = [{ data: previous }];
    sm.api.get = async () => ({ settings: {} });
    // Persistence has its own transaction tests; the UI refresh is a host boundary.
    sm.updateStorage = async () => {};
    sm.updateEntryIndicators = sm.updateInspector = sm.updateEntries = () => {};
    await sm.saveActiveProfileChanges();
    const entries = Object.values(sm.memoryStorage.entries.data);
    assert.equal(entries.length, 2);
    assert.equal(sm.memoryStorage.entries.data[1].componentSettings[path], 35);
    assert.equal(sm.memoryStorage.entries.data[1].configVersionNumber, 2);
    const archived = entries.find(state => state.groups.indexOf('favourites') === -1);
    assert.equal(archived.componentSettings[path], 20);
});

test('aborted IndexedDB writes reject the save operation', async () => {
    const { sm, request } = host();
    const transaction = { objectStore: () => ({ put() {} }), commit() {}, error: new Error('Quota exceeded') };
    request.onsuccess.call({ result: { transaction: () => transaction } });
    const saving = sm.updateLocalStorage(new Uint8Array([1]));
    transaction.onabort();
    await assert.rejects(saving, /Quota exceeded/);
});

test('the UI is mounted after defaults, selectors and component mappings are ready', async () => {
    const { sm } = host();
    let releaseSelectors;
    let mounted = false;
    sm.api.get = async endpoint => {
        if (endpoint === 'version') return { version: 'fixture' };
        if (endpoint === 'savelocation') return { location: 'File' };
        if (endpoint === 'filedata') return { data: null };
        if (endpoint === 'uidefaults') return { hash: 'fixture', contents: {} };
        if (endpoint === 'componentids') return { 'txt2img/CFG Scale/value': { id: null, source: 'ui-config' } };
        if (endpoint === 'forgeneomap') return new Promise(resolve => { releaseSelectors = resolve; });
        throw new Error(`Unexpected endpoint: ${endpoint}`);
    };
    sm.injectUI = () => {
        assert.ok(sm.memoryStorage.currentDefault);
        assert.equal(sm.componentMapReady, true);
        mounted = true;
    };
    const initializing = sm.init();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mounted, false);
    releaseSelectors(selectors);
    await initializing;
    assert.equal(mounted, true);
});

function applicationHost() {
    const fixture = host();
    const { sm, elements } = fixture;
    const path = 'txt2img/Sampling Steps';
    const input = new Input('number', 20);
    elements.set('txt2img_steps', wrapper('txt2img_steps', input));
    sm.componentMapReady = true;
    sm.memoryStorage.currentDefault = { hash: 'fixture', contents: { [path]: 20 } };
    sm.memoryStorage.savedDefaults = { fixture: { [path]: 20, 'img2img/Sampling Steps': 9 } };
    sm.componentMap[path] = { entries: [{ source: 'ui-config', path }] };
    let options = { sd_model_checkpoint: 'Original' };
    sm.api.get = async () => ({ settings: { ...options } });
    sm.api.post = async (endpoint, body) => {
        assert.equal(endpoint, 'quicksettings');
        Object.assign(options, JSON.parse(body.contents));
        return { success: true };
    };
    return { ...fixture, input, path, state: { type: 'txt2img', defaults: 'fixture',
        quickSettings: { sd_model_checkpoint: 'New' }, componentSettings: { [path]: 35 } } };
}

test('full application awaits options, reports each outcome, and leaves saved values immutable', async () => {
    const { sm, state, input, path } = applicationHost();
    state.componentSettings['txt2img/Removed extension'] = true;
    state.quickSettings.obsolete_option = true;
    const original = JSON.stringify(state);
    const report = await sm.applyAll(state);
    assert.equal(input.value, '35');
    assert.equal((await sm.getQuickSettings()).sd_model_checkpoint, 'New');
    assert.equal(report.items.filter(item => item.status === 'applied').length, 2);
    assert.equal(report.items.filter(item => item.status === 'unavailable').length, 2);
    assert.ok(report.items.some(item => item.path === path));
    assert.equal(JSON.stringify(state), original);
    assert.ok(!report.items.some(item => item.path.startsWith('img2img/')));
});

test('a broken control does not stop later fields and is never reported applied', () => {
    const { sm, path, input } = applicationHost();
    sm.componentMap['txt2img/Broken'] = { entries: [{ component: { props: { value: 1 },
        instance: { $set() { throw new Error('Host refused'); } } } }] };
    const items = sm.applyComponentSettings({ 'txt2img/Broken': 2, [path]: 44 });
    assert.equal(items[0].status, 'failed');
    assert.equal(items[1].status, 'applied');
    assert.equal(input.value, '44');
});

test('Undo restores the pre-apply UI and options without writing config history', async () => {
    const { sm, state, input } = applicationHost();
    await sm.applyAll(state);
    const report = await sm.undoLastConfigApply();
    assert.equal(input.value, '20');
    assert.equal((await sm.getQuickSettings()).sd_model_checkpoint, 'Original');
    assert.equal(report.items.every(item => item.status === 'applied'), true);
    assert.equal(sm.lastConfigUndo, null);
    assert.equal(Object.keys(sm.memoryStorage.entries.data).length, 0);
});

test('failed preflight performs no writes and keeps the preceding Undo', async () => {
    const { sm, state, input } = applicationHost();
    await sm.applyAll(state);
    const undo = sm.lastConfigUndo;
    sm.api.get = async () => { throw new Error('Offline'); };
    const report = await sm.applyAll({ ...state, componentSettings: { 'txt2img/Sampling Steps': 60 } });
    assert.equal(input.value, '35');
    assert.equal(sm.lastConfigUndo, undo);
    assert.match(report.error, /Offline/);
});

test('concurrent config applications cannot interleave', async () => {
    const { sm, state, input } = applicationHost();
    let release;
    const post = sm.api.post;
    sm.api.post = async (...args) => { await new Promise(resolve => { release = resolve; }); return post(...args); };
    const applying = sm.applyAll(state);
    await new Promise(resolve => setImmediate(resolve));
    const blocked = await sm.applyAll({ ...state, componentSettings: { 'txt2img/Sampling Steps': 99 } });
    assert.equal(blocked.blocked, true);
    assert.equal(input.value, '20');
    release();
    await applying;
    assert.equal(input.value, '35');
});

test('quicksettings readback detects options that the backend silently ignores', async () => {
    const { sm, state } = applicationHost();
    sm.api.post = async () => ({ success: true });
    const report = await sm.applyAll(state);
    assert.equal(report.items.find(item => item.path === 'sd_model_checkpoint').status, 'failed');
});

test('partial Undo can be retried and does not repeat fields already restored', async () => {
    const { sm, state, input, path } = applicationHost();
    await sm.applyAll(state);
    const post = sm.api.post;
    sm.api.post = async () => ({ success: false });
    const report = await sm.undoLastConfigApply();
    assert.equal(report.items.find(item => item.path === 'sd_model_checkpoint').status, 'failed');
    assert.equal(input.value, '20');
    assert.equal(sm.lastConfigUndo.componentSettings[path], undefined);
    assert.equal(sm.lastConfigUndo.quickSettings.sd_model_checkpoint, 'Original');
    // An unrelated edit made after the first Undo must survive the retry.
    input.value = '22';
    sm.api.post = post;
    await sm.undoLastConfigApply();
    assert.equal(input.value, '22');
    assert.equal(sm.lastConfigUndo, null);
});

test('the pending-edit guard blocks application and Undo without replacing its snapshot', async () => {
    const { sm, state, input } = applicationHost();
    await sm.applyAll(state);
    const snapshot = sm.lastConfigUndo;
    sm.activeProfileDraft = { dirty: true };
    assert.equal((await sm.undoLastConfigApply()).blocked, true);
    assert.equal((await sm.applyAll(state)).blocked, true);
    assert.equal(sm.lastConfigUndo, snapshot);
    assert.equal(input.value, '35');
});

test('host updates that reject a value in their next microtask are reported failed', async () => {
    const { sm, state, input, path } = applicationHost();
    input.addEventListener('change', () => queueMicrotask(() => { input.value = '20'; }));
    const report = await sm.applyAll(state);
    assert.equal(report.items.find(item => item.path === path).status, 'failed');
});

test('UI comparison distinguishes numbers and booleans while accepting numeric input strings', () => {
    const { sm } = host();
    assert.equal(sm.utils.areLooselyEqualValue(20, 35), false);
    assert.equal(sm.utils.areLooselyEqualValue(true, false), false);
    assert.equal(sm.utils.areLooselyEqualValue(20, '20'), true);
    assert.equal(sm.utils.areLooselyEqualValue([20], [35]), false);
    assert.equal(sm.utils.areLooselyEqualValue([20], { 0: 20 }), false);
});

test('unavailable option choices are reported before the options API is mutated', async () => {
    const { sm, state } = applicationHost();
    sm.componentMap.sd_model_checkpoint = { entries: [{ component: { props: {
        value: 'Original', choices: ['Original', 'Installed'] } } }] };
    const report = await sm.applyAll(state);
    assert.equal(report.items.find(item => item.path === 'sd_model_checkpoint').status, 'unavailable');
    assert.equal((await sm.getQuickSettings()).sd_model_checkpoint, 'Original');
});

test('portable export includes original defaults and overrides without installation identity', () => {
    const { sm, state, path } = applicationHost();
    sm.memoryStorage.savedDefaults.fixture['txt2img/Width'] = 768;
    state.name = 'Portrait';
    state.createdAt = 123;
    state.preview = '/file=private/image.png';
    const portable = sm.createPortableConfig(state);
    assert.equal(portable.format, 'state-manager-neo/config');
    assert.equal(portable.version, 1);
    assert.equal(portable.config.componentSettings[path], 35);
    assert.equal(portable.config.componentSettings['txt2img/Width'], 768);
    assert.equal(portable.config.defaults, undefined);
    assert.equal(portable.config.createdAt, undefined);
    assert.equal(portable.config.preview, undefined);
    assert.equal(sm.parsePortableConfig(JSON.stringify(portable)).config.name, 'Portrait');
});

test('portable files reject unsupported versions, unsafe keys, invalid types and excessive size', () => {
    const { sm, state } = applicationHost();
    const portable = sm.createPortableConfig({ ...state, name: 'Portrait' });
    assert.throws(() => sm.parsePortableConfig(JSON.stringify({ ...portable, version: 2 })), /version/i);
    assert.throws(() => sm.parsePortableConfig(JSON.stringify({ ...portable,
        config: { ...portable.config, type: 'other' } })), /type/i);
    assert.throws(() => sm.parsePortableConfig(JSON.stringify({ ...portable,
        config: { ...portable.config, componentSettings: { 'img2img/Sampling Steps': 20 } } })), /path|type/i);
    const unsafe = JSON.stringify(portable).replace('"componentSettings":{', '"componentSettings":{"__proto__":{},');
    assert.throws(() => sm.parsePortableConfig(unsafe), /key|path/i);
    assert.throws(() => sm.parsePortableConfig(' '.repeat(2 * 1024 * 1024 + 1)), /large/i);
    assert.throws(() => sm.parsePortableConfig('{not json}'), /JSON/i);
});

test('import saves a distinct config, preserves full values across installations, and does not apply', async () => {
    const { sm, state, path, input } = applicationHost();
    const existing = { ...state, name: 'Portrait', createdAt: 1, groups: ['favourites'] };
    sm.memoryStorage.entries.data[1] = existing;
    sm.memoryStorage.favouritesOrder = ['1'];
    sm.memoryStorage.savedDefaults.fixture['txt2img/Width'] = 768;
    const portable = sm.createPortableConfig(existing);
    sm.memoryStorage.currentDefault = { hash: 'destination', contents: { [path]: 50, 'txt2img/Width': 512 } };
    sm.memoryStorage.savedDefaults.destination = sm.memoryStorage.currentDefault.contents;
    let persisted;
    sm.api.get = async () => ({ location: 'File' });
    sm.api.post = async (endpoint, body) => { assert.equal(endpoint, 'save'); persisted = body.contents; return { success: true }; };
    const imported = await sm.importPortableConfig(portable, 'Portrait');
    assert.notEqual(imported.createdAt, existing.createdAt);
    assert.equal(sm.memoryStorage.entries.data[1], existing);
    assert.equal(sm.getEffectiveComponentSettings(imported)['txt2img/Width'], 768);
    assert.equal(input.value, '20');
    assert.equal(imported.configVersionNumber, undefined);
    const stored = JSON.parse(require('node:zlib').gunzipSync(Buffer.from(persisted.split(',').map(Number))));
    assert.equal(stored.entries[imported.createdAt].name, 'Portrait');
    assert.ok(stored.defaults[imported.defaults]);
});

test('failed import persistence leaves existing configs and their order intact', async () => {
    const { sm, state } = applicationHost();
    const portable = sm.createPortableConfig({ ...state, name: 'Portrait' });
    const existing = { ...state, createdAt: 1, groups: ['favourites'] };
    sm.memoryStorage.entries.data[1] = existing;
    sm.memoryStorage.favouritesOrder = ['1'];
    const defaultsBefore = JSON.stringify(sm.memoryStorage.savedDefaults);
    sm.api.get = async () => ({ location: 'File' });
    sm.api.post = async () => ({ success: false });
    await assert.rejects(sm.importPortableConfig(portable, 'Imported'));
    assert.equal(Object.keys(sm.memoryStorage.entries.data).length, 1);
    assert.equal(sm.memoryStorage.entries.data[1], existing);
    assert.equal(sm.memoryStorage.favouritesOrder.join(','), '1');
    assert.equal(JSON.stringify(sm.memoryStorage.savedDefaults), defaultsBefore);
    assert.equal(sm.isSavingCurrentConfig, false);
});
