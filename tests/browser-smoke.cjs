// Optional browser host fixture: use an installed Playwright and Edge.
// This tests actual DOM/IndexedDB behavior, not an installed Forge server.
const { chromium } = require(process.env.STATE_MANAGER_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
        await page.route('http://state-manager.test/**', route => route.fulfill({
            contentType: 'text/html', body: `<html><body><div class="contain"><div id="tabs" class="svelte-fixture">
            <button class="lg secondary gradio-button tool svelte-fixture">Host tool</button>
            <input type="checkbox" class="svelte-fixture"><div id="txt2img_prompt"><label class="svelte-fixture">Prompt</label></div>
            <div id="txt2img_steps"><input type="number" value="20"></div><div id="txt2img_results_panel"></div>
            </div></div></body></html>`
        }));
        await page.goto('http://state-manager.test/');
        await page.addStyleTag({ path: path.join(__dirname, '../style.css') });
        await page.addStyleTag({ content: `:root {font:14px Arial;--body-text-color:#ddd;--body-background-fill:#171717;
            --border-color-primary:#444;--input-border-color:#555;--input-background-fill:#222;--input-radius:4px;
            --button-primary-background-fill:#b45309;--button-primary-border-color:#d97706;--button-primary-text-color:white}
            body {margin:0;background:#171717;color:#ddd} button,input {font:inherit} button {cursor:pointer}
            button {background:#333;color:#ddd;border:1px solid #555;border-radius:4px;padding:4px 8px}
            input {background:#222;color:#ddd;border:1px solid #555} .sd-webui-sm-side-panel {width:100%}` });
        await page.evaluate(() => {
            window.gradioApp = () => document;
            window.gradio_config = { components: [] };
            window.uiCurrentTab = { innerText: 'txt2img' };
            window.onUiLoaded = window.onAfterUiUpdate = () => {};
            window.submit = window.submit_img2img = () => {};
        });
        await page.addScriptTag({ path: path.join(__dirname, '../javascript/statemanager.js') });
        await page.evaluate(() => {
            const sm = window.stateManager;
            const path = 'txt2img/Sampling Steps';
            sm.forgeNeoSelectorMap = { [path]: '#txt2img_steps' };
            sm.componentMapReady = true;
            sm.componentMap = { [path]: { entries: [{ source: 'ui-config', path }] } };
            sm.memoryStorage.currentDefault = { hash: 'fixture', contents: { [path]: 20 } };
            sm.memoryStorage.savedDefaults = { fixture: { [path]: 20 } };
            let options = { sd_model_checkpoint: 'Original' };
            sm.api.get = async endpoint => endpoint === 'quicksettings' ? { settings: { ...options } }
                : { location: "Browser's Indexed DB" };
            sm.api.post = async (endpoint, body) => {
                if (endpoint !== 'quicksettings') throw new Error(`Unexpected endpoint ${endpoint}`);
                Object.assign(options, JSON.parse(body.contents));
                return { success: true };
            };
            sm.injectUI();
            const nav = document.querySelector('.sd-webui-sm-navigation');
            const exporting = document.createElement('button');
            exporting.innerText = 'Export fixture';
            exporting.addEventListener('click', () => sm.downloadPortableConfig(window.fixtureState));
            document.querySelector('#tabs').prepend(exporting);
            window.fixtureState = { name: 'Portrait', type: 'txt2img', defaults: 'fixture',
                quickSettings: { sd_model_checkpoint: 'New' },
                componentSettings: { [path]: 35, 'txt2img/Removed extension': true } };
        });
        await page.evaluate(() => window.stateManager.applyAll(window.fixtureState));
        await page.getByText('Config: 2 applied · 1 unavailable · 0 failed', { exact: true }).waitFor();
        await page.getByText('Details', { exact: true }).click();
        assert.match(await page.locator('.sd-webui-sm-apply-feedback ul').innerText(), /Removed extension: unavailable/);
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        await page.getByText('Undo: 2 applied · 0 unavailable · 0 failed', { exact: true }).waitFor();
        assert.equal(await page.locator('#txt2img_steps input').inputValue(), '20');
        assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled(), true);
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export fixture' }).click();
        const download = await downloadPromise;
        assert.equal(download.suggestedFilename(), 'Portrait.json');
        const downloaded = JSON.parse(require('node:fs').readFileSync(await download.path(), 'utf8'));
        assert.equal(downloaded.config.componentSettings['txt2img/Sampling Steps'], 35);
        const portable = JSON.stringify(downloaded);
        await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
        await page.locator('#sd-webui-sm-import-form input[type=file]').setInputFiles({
            name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken')
        });
        await page.getByText('Choose a valid config JSON file.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Import as New Config' }).isDisabled(), true);
        await page.locator('#sd-webui-sm-import-form input[type=file]').setInputFiles({
            name: 'Portrait.json', mimeType: 'application/json', buffer: Buffer.from(portable)
        });
        await page.getByRole('textbox', { name: 'Import name' }).waitFor();
        await page.waitForFunction(() => !document.querySelector('#sd-webui-sm-import-form button[type=submit]').disabled);
        assert.equal(await page.locator('#txt2img_steps input').inputValue(), '20');
        assert.equal(await page.evaluate(() => Object.keys(window.stateManager.memoryStorage.entries.data).length), 0);
        await page.getByRole('textbox', { name: 'Import name' }).press('Escape');
        assert.equal(await page.locator('#sd-webui-sm-import-form').isVisible(), false);
        await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
        await page.locator('#sd-webui-sm-import-form input[type=file]').setInputFiles({
            name: 'Portrait.json', mimeType: 'application/json', buffer: Buffer.from(portable)
        });
        await page.waitForFunction(() => !document.querySelector('#sd-webui-sm-import-form button[type=submit]').disabled);
        await page.getByText('Preview values', { exact: true }).click();
        for (const width of [1280, 380]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            const nav = await page.locator('.sd-webui-sm-navigation').boundingBox();
            const feedback = await page.locator('.sd-webui-sm-apply-feedback').boundingBox();
            assert.ok(feedback.y + feedback.height <= nav.y + nav.height + 1);
        }
        await page.getByRole('textbox', { name: 'Import name' }).fill('Imported portrait');
        await page.getByRole('textbox', { name: 'Import name' }).press('Enter');
        await page.getByText('Imported "Imported portrait" as a new config. Values were not applied.', { exact: true }).waitFor();
        const storedName = await page.evaluate(async () => {
            const sm = window.stateManager;
            const compressed = await new Promise(resolve => sm.ldb.get('sd-webui-state-manager-data', resolve));
            const decoded = await sm.processStorageData(compressed);
            return Object.values(decoded.entries)[0].name;
        });
        assert.equal(storedName, 'Imported portrait');
        assert.equal(await page.locator('#txt2img_steps input').inputValue(), '20');
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(await page.locator('#sd-webui-sm-import-form').isVisible(), false);
        await page.evaluate(() => {
            const sm = window.stateManager;
            const entry = Array.from(document.querySelectorAll('.sd-webui-sm-entry'))
                .find(entry => entry.data?.name === 'Imported portrait');
            if (!entry) throw new Error('Imported config card was not rendered');
            sm.selection.select(entry, 'single');
        });
        const inspectorDownload = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
        assert.equal((await inspectorDownload).suggestedFilename(), 'Imported_portrait.json');
        // Exercise the same controls in the actual modal panel.
        await page.evaluate(() => {
            const sm = window.stateManager;
            sm.panelContainer.classList.add('sd-webui-sm-modal-panel');
            sm.mountPanelContainer();
            sm.syncModalOverlayState();
        });
        await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
        const modalNav = await page.locator('.sd-webui-sm-navigation').boundingBox();
        const modalEntries = await page.locator('.sd-webui-sm-entry-container').boundingBox();
        assert.ok(modalEntries.y >= modalNav.y + modalNav.height - 1, 'Modal entries overlap navigation feedback');
        await page.locator('#sd-webui-sm-import-form input[type=file]').setInputFiles({
            name: 'Portrait.json', mimeType: 'application/json', buffer: Buffer.from(portable)
        });
        await page.waitForFunction(() => !document.querySelector('#sd-webui-sm-import-form button[type=submit]').disabled);
        await page.getByText('Preview values', { exact: true }).click();
        if (process.env.STATE_MANAGER_SCREENSHOT) {
            await page.screenshot({ path: process.env.STATE_MANAGER_SCREENSHOT.replace(/\.png$/, '-import.png') });
        }
        await page.locator('#sd-webui-sm-import-form input[type=file]').press('Escape');
        assert.equal(await page.locator('#sd-webui-sm-import-form').isVisible(), false);
        assert.equal(await page.evaluate(() => window.stateManager.panelContainer.classList.contains('sd-webui-sm-modal-panel')), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (process.env.STATE_MANAGER_SCREENSHOT) await page.screenshot({ path: process.env.STATE_MANAGER_SCREENSHOT });
        console.log('Browser host fixture passed: apply report, Undo, JSON download, import preview/cancel/Enter, real IndexedDB, wide/narrow layout.');
    }
    finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
