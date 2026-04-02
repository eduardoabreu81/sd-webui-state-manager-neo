(function (sm) {
    // https://github.com/DVLP/localStorageDB - Allows use of indexedDB with a simple localStorage-like wrapper
    // @ts-ignore
    !function () { var s, c, e = "undefined" != typeof window ? window : {}, t = e.indexedDB || e.mozIndexedDB || e.webkitIndexedDB || e.msIndexedDB; "undefined" == typeof window || t ? ((t = t.open("ldb", 1)).onsuccess = function (e) { s = this.result; }, t.onerror = function (e) { console.error("indexedDB request error"), console.log(e); }, t = { get: (c = { ready: !(t.onupgradeneeded = function (e) { s = null, e.target.result.createObjectStore("s", { keyPath: "k" }).transaction.oncomplete = function (e) { s = e.target.db; }; }), get: function (e, t) { s ? s.transaction("s").objectStore("s").get(e).onsuccess = function (e) { e = e.target.result && e.target.result.v || null; t(e); } : setTimeout(function () { c.get(e, t); }, 50); }, set: function (t, n, o) { if (s) {
                let e = s.transaction("s", "readwrite");
                e.oncomplete = function (e) { "Function" === {}.toString.call(o).slice(8, -1) && o(); }, e.objectStore("s").put({ k: t, v: n }), e.commit();
            }
            else
                setTimeout(function () { c.set(t, n, o); }, 50); }, delete: function (e, t) { s ? s.transaction("s", "readwrite").objectStore("s").delete(e).onsuccess = function (e) { t && t(); } : setTimeout(function () { c.delete(e, t); }, 50); }, list: function (t) { s ? s.transaction("s").objectStore("s").getAllKeys().onsuccess = function (e) { e = e.target.result || null; t(e); } : setTimeout(function () { c.list(t); }, 50); }, getAll: function (t) { s ? s.transaction("s").objectStore("s").getAll().onsuccess = function (e) { e = e.target.result || null; t(e); } : setTimeout(function () { c.getAll(t); }, 50); }, clear: function (t) { s ? s.transaction("s", "readwrite").objectStore("s").clear().onsuccess = function (e) { t && t(); } : setTimeout(function () { c.clear(t); }, 50); } }).get, set: c.set, delete: c.delete, list: c.list, getAll: c.getAll, clear: c.clear }, sm.ldb = t, "undefined" != typeof module && (module.exports = t)) : console.error("indexDB not supported"); }();
    const app = gradioApp();
    const looselyEqualUIValues = new Set([null, undefined, "", "None"]);
    const entriesPerPage = 25;
    const modalEntriesPerPage = 100;
    const initialEntrySlotCount = entriesPerPage;
    const previewImageMaxSize = 100;
    const updateEntriesDebounceMs = 150;
    const updateStorageDebounceMs = 600;
    const uiSettingsStorageKey = 'sd-webui-state-manager-ui-settings';
    const entryFilterStorageKey = 'sd-webui-state-manager-entry-filter';
    const previewObserverRootMargin = '120px';
    const validSorts = new Set(['newest', 'oldest', 'name', 'type', 'manual']);
    const validPanelTabs = new Set(['history', 'favourites', 'settings']);
    const validDateFormats = new Set(['ddmmyyyy', 'mmddyyyy']);
    const loadedPreviewUrls = new Set();
    let entryEventListenerAbortController = new AbortController();
    let updateEntriesDebounceHandle = null;
    let updateStorageDebounceHandle = null;
    sm.autoSaveHistory = false;
    sm.lastHeadImage = null;
    sm.lastUsedState = null;
    sm.quickMenuSelectedStateKey = null;
    sm.hasAppliedStartupConfig = false;
    sm.activePanelTab = 'history';
    sm.uiSettings = {
        historySmallViewEntriesPerPage: entriesPerPage,
        favouritesSmallViewEntriesPerPage: entriesPerPage,
        collapseSmallViewAccordion: false,
        showSmallViewPagination: false,
        showEntryFooter: false,
        dateFormat: 'ddmmyyyy',
        defaultSort: 'newest',
        rememberFilters: false,
        defaultShowFavouritesInHistory: false,
        showConfigNamesOnCards: true,
        alwaysShowConfigTypeBadge: false,
        showConfigsFirst: true,
        defaultOpenTab: 'favourites',
        hideSearchByDefault: false,
        preventApplyWithUnsavedConfigEdits: true,
        startupConfigStateKey: ''
    };
    sm.inspectorPreviewOnly = false;
    sm.loadedEntryFilter = null;
    sm.ldb.get('sd-webui-state-manager-autosave', autosave => {
        if (autosave == null) {
            return;
        }
        sm.autoSaveHistory = autosave;
        const autosaveCheckbox = app.querySelector('#sd-webui-sm-autosave');
        if (autosaveCheckbox) {
            autosaveCheckbox.checked = autosave;
        }
    });
    sm.getNormalisedSortValue = function (value) {
        return validSorts.has(`${value}`) ? `${value}` : 'newest';
    };
    sm.getNormalisedPanelTabValue = function (value) {
        return validPanelTabs.has(`${value}`) ? `${value}` : 'favourites';
    };
    sm.getNormalisedDateFormatValue = function (value) {
        return validDateFormats.has(`${value}`) ? `${value}` : 'ddmmyyyy';
    };
    sm.getDefaultEntryFilter = function () {
        return {
            group: 'history',
            types: ['txt2img', 'img2img'],
            query: '',
            sort: sm.getNormalisedSortValue(sm.uiSettings.defaultSort),
            showFavouritesInHistory: Boolean(sm.uiSettings.defaultShowFavouritesInHistory)
        };
    };
    sm.getNormalisedUISettings = function (settings) {
        const normalised = {
            historySmallViewEntriesPerPage: entriesPerPage,
            favouritesSmallViewEntriesPerPage: entriesPerPage,
            collapseSmallViewAccordion: false,
            showSmallViewPagination: false,
            showEntryFooter: false,
            dateFormat: 'ddmmyyyy',
            defaultSort: 'newest',
            rememberFilters: false,
            defaultShowFavouritesInHistory: false,
            showConfigNamesOnCards: true,
            alwaysShowConfigTypeBadge: false,
            showConfigsFirst: true,
            defaultOpenTab: 'favourites',
            hideSearchByDefault: false,
            preventApplyWithUnsavedConfigEdits: true,
            startupConfigStateKey: ''
        };
        if (!settings || typeof settings !== 'object') {
            return normalised;
        }
        const legacySmallViewEntriesPerPage = Math.max(1, Number.parseInt(`${settings.smallViewEntriesPerPage ?? ''}`) || entriesPerPage);
        normalised.historySmallViewEntriesPerPage = Math.max(1, Number.parseInt(`${settings.historySmallViewEntriesPerPage ?? ''}`) || legacySmallViewEntriesPerPage);
        normalised.favouritesSmallViewEntriesPerPage = Math.max(1, Number.parseInt(`${settings.favouritesSmallViewEntriesPerPage ?? ''}`) || legacySmallViewEntriesPerPage);
        normalised.collapseSmallViewAccordion = Boolean(settings.collapseSmallViewAccordion);
        normalised.showSmallViewPagination = Boolean(settings.showSmallViewPagination);
        normalised.showEntryFooter = Boolean(settings.showEntryFooter);
        normalised.dateFormat = sm.getNormalisedDateFormatValue(settings.dateFormat);
        normalised.defaultSort = sm.getNormalisedSortValue(settings.defaultSort);
        normalised.rememberFilters = Boolean(settings.rememberFilters);
        normalised.defaultShowFavouritesInHistory = Boolean(settings.defaultShowFavouritesInHistory);
        normalised.showConfigNamesOnCards = settings.hasOwnProperty('showConfigNamesOnCards') ? Boolean(settings.showConfigNamesOnCards) : true;
        normalised.alwaysShowConfigTypeBadge = Boolean(settings.alwaysShowConfigTypeBadge);
        normalised.showConfigsFirst = Boolean(settings.showConfigsFirst);
        normalised.defaultOpenTab = sm.getNormalisedPanelTabValue(settings.defaultOpenTab);
        normalised.hideSearchByDefault = Boolean(settings.hideSearchByDefault);
        normalised.preventApplyWithUnsavedConfigEdits = Boolean(settings.preventApplyWithUnsavedConfigEdits);
        normalised.startupConfigStateKey = `${settings.startupConfigStateKey ?? ''}`;
        return normalised;
    };
    sm.getNormalisedStoredEntryFilter = function (filter) {
        if (!filter || typeof filter !== 'object') {
            return null;
        }
        const validGroups = new Set(['history', 'favourites']);
        const group = validGroups.has(`${filter.group}`) ? `${filter.group}` : 'history';
        const types = Array.isArray(filter.types) ? filter.types.filter(t => t == 'txt2img' || t == 'img2img') : ['txt2img', 'img2img'];
        return {
            group,
            types: types.length > 0 ? types : ['txt2img', 'img2img'],
            query: `${filter.query ?? ''}`,
            sort: sm.getNormalisedSortValue(filter.sort),
            showFavouritesInHistory: Boolean(filter.showFavouritesInHistory)
        };
    };
    sm.collectSearchableEntryText = function (value, visited = new Set()) {
        if (value === null || value === undefined) {
            return '';
        }
        const valueType = typeof value;
        if (valueType == 'string' || valueType == 'number' || valueType == 'boolean') {
            return `${value}`.toLowerCase();
        }
        if (Array.isArray(value)) {
            return value.map(item => sm.collectSearchableEntryText(item, visited)).filter(text => text.length > 0).join(' ');
        }
        if (valueType == 'object') {
            if (visited.has(value)) {
                return '';
            }
            visited.add(value);
            const pieces = [];
            for (const [key, child] of Object.entries(value)) {
                const lowerKey = `${key}`.toLowerCase();
                if (lowerKey == 'preview' || lowerKey == 'image' || lowerKey == 'thumbnail' || lowerKey == 'blob' || lowerKey == 'datauri') {
                    continue;
                }
                pieces.push(lowerKey);
                const childText = sm.collectSearchableEntryText(child, visited);
                if (childText.length > 0) {
                    pieces.push(childText);
                }
            }
            visited.delete(value);
            return pieces.join(' ').trim();
        }
        return '';
    };
    sm.syncEntryFilterControls = function () {
        if (!sm.panelContainer) {
            return;
        }
        const searchInput = sm.panelContainer.querySelector('.sd-webui-sm-entry-header .search-row input');
        const txt2imgCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-filter-txt2img');
        const img2imgCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-filter-img2img');
        const showSavedCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-filter-favourites-checkbox');
        const sortSelect = sm.panelContainer.querySelector('#sd-webui-sm-sort');
        if (searchInput) {
            searchInput.value = sm.entryFilter.query;
        }
        if (txt2imgCheckbox) {
            txt2imgCheckbox.checked = sm.entryFilter.types.indexOf('txt2img') > -1;
        }
        if (img2imgCheckbox) {
            img2imgCheckbox.checked = sm.entryFilter.types.indexOf('img2img') > -1;
        }
        if (showSavedCheckbox) {
            showSavedCheckbox.checked = sm.entryFilter.showFavouritesInHistory;
        }
        if (sortSelect) {
            sortSelect.value = sm.getNormalisedSortValue(sm.entryFilter.sort);
        }
    };
    sm.syncUISettingsControls = function () {
        if (!sm.panelContainer) {
            return;
        }
        const historySmallViewEntriesInput = sm.panelContainer.querySelector('#sd-webui-sm-settings-small-view-entries-history');
        const favouritesSmallViewEntriesInput = sm.panelContainer.querySelector('#sd-webui-sm-settings-small-view-entries-favourites');
        const showSmallViewPaginationCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-small-view-pagination');
        const showEntryFooterCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-entry-footer');
        const dateFormatSelect = sm.panelContainer.querySelector('#sd-webui-sm-settings-date-format');
        const defaultSortSelect = sm.panelContainer.querySelector('#sd-webui-sm-settings-default-sort');
        const rememberFiltersCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-remember-filters');
        const defaultShowFavouritesCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-default-show-favourites');
        const showConfigNamesCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-config-names');
        const showConfigTypeBadgeCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-config-type-badge');
        const showConfigsFirstCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-show-configs-first');
        const defaultOpenTabSelect = sm.panelContainer.querySelector('#sd-webui-sm-settings-default-open-tab');
        const hideSearchByDefaultCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-hide-search');
        const preventApplyWithUnsavedEditsCheckbox = sm.panelContainer.querySelector('#sd-webui-sm-settings-prevent-apply-unsaved-edits');
        if (historySmallViewEntriesInput) {
            historySmallViewEntriesInput.value = `${Math.max(1, Number(sm.uiSettings.historySmallViewEntriesPerPage) || entriesPerPage)}`;
        }
        if (favouritesSmallViewEntriesInput) {
            favouritesSmallViewEntriesInput.value = `${Math.max(1, Number(sm.uiSettings.favouritesSmallViewEntriesPerPage) || entriesPerPage)}`;
        }
        if (showSmallViewPaginationCheckbox) {
            showSmallViewPaginationCheckbox.checked = Boolean(sm.uiSettings.showSmallViewPagination);
        }
        if (showEntryFooterCheckbox) {
            showEntryFooterCheckbox.checked = Boolean(sm.uiSettings.showEntryFooter);
        }
        if (dateFormatSelect) {
            dateFormatSelect.value = sm.getNormalisedDateFormatValue(sm.uiSettings.dateFormat);
        }
        if (defaultSortSelect) {
            defaultSortSelect.value = sm.getNormalisedSortValue(sm.uiSettings.defaultSort);
        }
        if (rememberFiltersCheckbox) {
            rememberFiltersCheckbox.checked = Boolean(sm.uiSettings.rememberFilters);
        }
        if (defaultShowFavouritesCheckbox) {
            defaultShowFavouritesCheckbox.checked = Boolean(sm.uiSettings.defaultShowFavouritesInHistory);
        }
        if (showConfigNamesCheckbox) {
            showConfigNamesCheckbox.checked = Boolean(sm.uiSettings.showConfigNamesOnCards);
        }
        if (showConfigTypeBadgeCheckbox) {
            showConfigTypeBadgeCheckbox.checked = Boolean(sm.uiSettings.alwaysShowConfigTypeBadge);
        }
        if (showConfigsFirstCheckbox) {
            showConfigsFirstCheckbox.checked = Boolean(sm.uiSettings.showConfigsFirst);
        }
        if (defaultOpenTabSelect) {
            defaultOpenTabSelect.value = sm.getNormalisedPanelTabValue(sm.uiSettings.defaultOpenTab);
        }
        if (hideSearchByDefaultCheckbox) {
            hideSearchByDefaultCheckbox.checked = Boolean(sm.uiSettings.hideSearchByDefault);
        }
        if (preventApplyWithUnsavedEditsCheckbox) {
            preventApplyWithUnsavedEditsCheckbox.checked = Boolean(sm.uiSettings.preventApplyWithUnsavedConfigEdits);
        }
        sm.syncStartupConfigSettingsControls?.();
    };
    sm.saveUISettings = function () {
        sm.ldb.set(uiSettingsStorageKey, sm.getNormalisedUISettings(sm.uiSettings));
    };
    sm.persistEntryFilterIfEnabled = function () {
        if (!sm.uiSettings.rememberFilters) {
            sm.ldb.delete(entryFilterStorageKey);
            return;
        }
        sm.ldb.set(entryFilterStorageKey, {
            group: sm.entryFilter.group == 'favourites' ? 'favourites' : 'history',
            types: [...sm.entryFilter.types],
            query: sm.entryFilter.query,
            sort: sm.getNormalisedSortValue(sm.entryFilter.sort),
            showFavouritesInHistory: Boolean(sm.entryFilter.showFavouritesInHistory)
        });
    };
    sm.getSavedConfigsForStartupSelection = function () {
        if (!sm.memoryStorage?.entries?.data) {
            return [];
        }
        const orderedStateKeys = sm.ensureFavouritesOrder?.() || [];
        const savedConfigs = [];
        const seenStateKeys = new Set();
        for (const stateKey of orderedStateKeys) {
            const key = `${stateKey ?? ''}`;
            if (key.length == 0 || seenStateKeys.has(key)) {
                continue;
            }
            const state = sm.memoryStorage.entries.data[key];
            if (!state || (state.groups?.indexOf('favourites') ?? -1) == -1) {
                continue;
            }
            savedConfigs.push(state);
            seenStateKeys.add(key);
        }
        for (const stateKey of Object.keys(sm.memoryStorage.entries.data)) {
            const key = `${stateKey ?? ''}`;
            if (key.length == 0 || seenStateKeys.has(key)) {
                continue;
            }
            const state = sm.memoryStorage.entries.data[key];
            if (!state || (state.groups?.indexOf('favourites') ?? -1) == -1) {
                continue;
            }
            savedConfigs.push(state);
            seenStateKeys.add(key);
        }
        return savedConfigs;
    };
    sm.syncStartupConfigSettingsControls = function () {
        const startupConfigSelect = sm.panelContainer?.querySelector('#sd-webui-sm-settings-startup-config');
        if (!startupConfigSelect) {
            return;
        }
        const startupConfigStateKey = `${sm.uiSettings.startupConfigStateKey ?? ''}`;
        const savedConfigs = sm.getSavedConfigsForStartupSelection?.() || [];
        let hasSelectedConfig = false;
        startupConfigSelect.innerHTML = '';
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.innerText = 'None';
        startupConfigSelect.appendChild(noneOption);
        for (const state of savedConfigs) {
            const stateKey = `${state.createdAt ?? ''}`;
            if (stateKey.length == 0) {
                continue;
            }
            const name = `${state.name ?? ''}`.trim();
            const fallbackDate = new Date(Number(state.createdAt ?? Date.now())).toISOString().replace('T', ' ').replace(/\.\d+Z/, '');
            const option = document.createElement('option');
            option.value = stateKey;
            option.innerText = name.length > 0 ? name : `Config ${fallbackDate}`;
            startupConfigSelect.appendChild(option);
            if (stateKey == startupConfigStateKey) {
                hasSelectedConfig = true;
            }
        }
        if (startupConfigStateKey.length > 0 && !hasSelectedConfig) {
            sm.uiSettings.startupConfigStateKey = '';
            sm.saveUISettings();
        }
        startupConfigSelect.value = hasSelectedConfig ? startupConfigStateKey : '';
        startupConfigSelect.disabled = savedConfigs.length == 0;
        if (savedConfigs.length == 0) {
            startupConfigSelect.title = 'Save at least one config to enable startup apply';
        }
        else {
            startupConfigSelect.title = 'Select a config to apply on startup. Choose None to disable.';
        }
    };
    sm.syncSearchRowVisibility = function () {
        const searchRow = sm.panelContainer?.querySelector('.sd-webui-sm-entry-toolbar-row.search-row');
        if (!searchRow) {
            return;
        }
        searchRow.style.display = sm.uiSettings.hideSearchByDefault ? 'none' : '';
    };
    sm.syncEntryFooterVisibility = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        if (!entryContainer) {
            return;
        }
        entryContainer.dataset['showEntryFooter'] = `${Boolean(sm.uiSettings.showEntryFooter)}`;
    };
    sm.syncConfigCardNameVisibility = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        if (!entryContainer) {
            return;
        }
        const showConfigNames = Boolean(sm.uiSettings.showConfigNamesOnCards && (sm.activePanelTab == 'favourites' || sm.activePanelTab == 'history'));
        entryContainer.dataset['showConfigNames'] = `${showConfigNames}`;
    };
    sm.syncConfigTypeBadgeVisibility = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        if (!entryContainer) {
            return;
        }
        const showTypeBadge = Boolean(sm.uiSettings.alwaysShowConfigTypeBadge && (sm.activePanelTab == 'favourites' || sm.activePanelTab == 'history'));
        entryContainer.dataset['showConfigTypeBadge'] = `${showTypeBadge}`;
    };
    sm.getFavouritesStateKeysNewestFirst = function () {
        if (!sm.memoryStorage?.entries?.data) {
            return [];
        }
        return Object.keys(sm.memoryStorage.entries.data)
            .filter(key => (sm.memoryStorage.entries.data[key]?.groups?.indexOf('favourites') ?? -1) > -1)
            .sort((a, b) => (Number(sm.memoryStorage.entries.data[b]?.createdAt ?? b) || 0) - (Number(sm.memoryStorage.entries.data[a]?.createdAt ?? a) || 0));
    };
    sm.getNormalisedFavouritesOrder = function (order) {
        const favouriteKeys = sm.getFavouritesStateKeysNewestFirst();
        const favouriteKeySet = new Set(favouriteKeys);
        const normalised = [];
        if (Array.isArray(order)) {
            for (const candidate of order) {
                const key = `${candidate ?? ''}`;
                if (key.length == 0 || !favouriteKeySet.has(key) || normalised.indexOf(key) > -1) {
                    continue;
                }
                normalised.push(key);
                favouriteKeySet.delete(key);
            }
        }
        for (const key of favouriteKeys) {
            if (favouriteKeySet.has(key)) {
                normalised.push(key);
            }
        }
        return normalised;
    };
    sm.ensureFavouritesOrder = function () {
        if (!sm.memoryStorage) {
            return [];
        }
        sm.memoryStorage.favouritesOrder = sm.getNormalisedFavouritesOrder(sm.memoryStorage.favouritesOrder);
        return [...sm.memoryStorage.favouritesOrder];
    };
    sm.appendFavouritesOrderKey = function (stateKey) {
        const key = `${stateKey ?? ''}`;
        if (key.length == 0 || !sm.memoryStorage) {
            return;
        }
        const currentOrder = sm.ensureFavouritesOrder();
        if (currentOrder.indexOf(key) > -1) {
            return;
        }
        currentOrder.push(key);
        sm.memoryStorage.favouritesOrder = currentOrder;
    };
    sm.removeFavouritesOrderKey = function (stateKey) {
        const key = `${stateKey ?? ''}`;
        if (key.length == 0 || !sm.memoryStorage) {
            return;
        }
        sm.memoryStorage.favouritesOrder = sm.ensureFavouritesOrder().filter((candidate) => candidate != key);
    };
    sm.getActiveFavouritesOrder = function () {
        if (sm.configReorderState?.active) {
            return sm.getNormalisedFavouritesOrder(sm.configReorderState.workingOrder);
        }
        return sm.ensureFavouritesOrder();
    };
    sm.getSelectedConfigStateKey = function () {
        if (sm.selection.entries.length != 1) {
            return null;
        }
        const selectedEntry = (sm.selection.entries[0] || null);
        const selectedStateKey = `${selectedEntry?.data?.createdAt ?? ''}`;
        if (selectedStateKey.length == 0) {
            return null;
        }
        const selectedState = sm.memoryStorage?.entries?.data?.[selectedStateKey];
        if (!selectedState || (selectedState.groups?.indexOf('favourites') ?? -1) == -1) {
            return null;
        }
        return selectedStateKey;
    };
    sm.isConfigReorderModeActive = function () {
        return Boolean(sm.configReorderState?.active);
    };
    sm.getQuickConfigMenuStates = function () {
        if (!sm.memoryStorage?.entries?.data) {
            return [];
        }
        const orderedStateKeys = sm.getActiveFavouritesOrder?.() || sm.ensureFavouritesOrder?.() || [];
        return orderedStateKeys
            .map((stateKey) => sm.memoryStorage.entries.data[stateKey])
            .filter((state) => Boolean(state))
            .slice(0, 10);
    };
    sm.syncQuickConfigApplyButtonState = function () {
        const applyButton = (sm.quickConfigApplyButton || null);
        if (!applyButton) {
            return;
        }
        const isModal = Boolean(sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel'));
        if (isModal) {
            applyButton.classList.add('sd-webui-sm-hidden');
            applyButton.disabled = true;
            applyButton.title = 'Available only in docked small view';
            return;
        }
        const selectedStateKey = `${sm.quickMenuSelectedStateKey ?? ''}`;
        const hasSelection = selectedStateKey.length > 0 && Boolean(sm.memoryStorage?.entries?.data?.[selectedStateKey]);
        const shouldShow = Boolean(sm.uiSettings.collapseSmallViewAccordion && hasSelection);
        applyButton.classList.toggle('sd-webui-sm-hidden', !shouldShow);
        applyButton.disabled = !hasSelection;
        applyButton.title = hasSelection ? 'Apply selected quick config' : 'Select a quick config first';
    };
    sm.syncQuickConfigMenuSelectionState = function () {
        const container = (sm.quickConfigMenuContainer || null);
        if (!container) {
            return;
        }
        const selectedStateKey = `${sm.quickMenuSelectedStateKey ?? ''}`;
        const quickConfigButtons = container.querySelectorAll('.sd-webui-sm-quick-config-item');
        for (const button of Array.from(quickConfigButtons)) {
            button.classList.toggle('active', `${button.dataset['stateKey'] ?? ''}` == selectedStateKey);
        }
        sm.syncQuickConfigApplyButtonState?.();
    };
    sm.ensureQuickConfigHoverTooltip = function () {
        let tooltip = (sm.quickConfigHoverTooltip || null);
        if (!tooltip) {
            tooltip = sm.createElementWithClassList('div', 'sd-webui-sm-quick-config-tooltip');
            tooltip.setAttribute('role', 'tooltip');
            tooltip.style.display = 'none';
            document.body.appendChild(tooltip);
            sm.quickConfigHoverTooltip = tooltip;
        }
        return tooltip;
    };
    sm.hideQuickConfigHoverTooltip = function () {
        const tooltip = (sm.quickConfigHoverTooltip || null);
        if (!tooltip) {
            return;
        }
        tooltip.style.display = 'none';
    };
    sm.showQuickConfigHoverTooltip = function (label, anchorElement) {
        const value = `${label ?? ''}`.trim();
        if (value.length == 0) {
            sm.hideQuickConfigHoverTooltip?.();
            return;
        }
        if (!anchorElement || !anchorElement.isConnected) {
            sm.hideQuickConfigHoverTooltip?.();
            return;
        }
        const tooltip = sm.ensureQuickConfigHoverTooltip();
        tooltip.textContent = value;
        tooltip.style.display = 'block';
        const viewportPadding = 4;
        const offsetY = 6;
        const anchorRect = anchorElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = anchorRect.left + ((anchorRect.width - tooltipRect.width) / 2);
        let top = anchorRect.top - tooltipRect.height - offsetY;
        if (top < viewportPadding) {
            top = anchorRect.bottom + offsetY;
        }
        left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
        top = Math.max(viewportPadding, Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    };
    sm.syncModalQuickControlsState = function () {
        const isModal = Boolean(sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel'));
        const quickSaveButton = (sm.quickSettingSaveButton || null);
        const quickApplyButton = (sm.quickConfigApplyButton || null);
        const quickMenuContainer = (sm.quickConfigMenuContainer || null);
        const accordionToggleButton = (sm.smallViewAccordionToggleButton || null);
        if (quickSaveButton) {
            quickSaveButton.classList.toggle('sd-webui-sm-hidden', isModal);
        }
        if (isModal && quickMenuContainer) {
            quickMenuContainer.style.display = 'none';
        }
        if (isModal && quickApplyButton) {
            quickApplyButton.classList.add('sd-webui-sm-hidden');
            quickApplyButton.disabled = true;
        }
        if (isModal) {
            sm.hideQuickConfigHoverTooltip?.();
        }
        if (accordionToggleButton) {
            accordionToggleButton.classList.toggle('sd-webui-sm-hidden', isModal);
            accordionToggleButton.disabled = isModal;
            if (isModal) {
                accordionToggleButton.style.setProperty('display', 'none', 'important');
            }
            else {
                accordionToggleButton.style.removeProperty('display');
            }
        }
    };
    sm.applyQuickSelectedConfig = function () {
        const selectedStateKey = `${sm.quickMenuSelectedStateKey ?? ''}`;
        const targetState = sm.memoryStorage?.entries?.data?.[selectedStateKey];
        if (!targetState) {
            sm.syncQuickConfigApplyButtonState?.();
            return;
        }
        if (!sm.canProceedWithApplyAction()) {
            return;
        }
        sm.applyAll(targetState);
        sm.quickMenuSelectedStateKey = null;
        sm.renderQuickConfigMenu?.();
        sm.syncQuickConfigApplyButtonState?.();
    };
    sm.renderQuickConfigMenu = function () {
        const container = (sm.quickConfigMenuContainer || null);
        const navControlButtons = (container?.parentElement || null);
        if (!container) {
            return;
        }
        const showQuickMenu = Boolean(sm.uiSettings.collapseSmallViewAccordion && !sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel'));
        if (navControlButtons) {
            navControlButtons.classList.toggle('sd-webui-sm-control-wide', showQuickMenu);
        }
        container.style.display = showQuickMenu ? 'flex' : 'none';
        if (!showQuickMenu) {
            sm.hideQuickConfigHoverTooltip?.();
            sm.syncQuickConfigApplyButtonState?.();
            return;
        }
        container.innerHTML = '';
        const quickConfigs = sm.getQuickConfigMenuStates();
        const quickConfigKeys = new Set(quickConfigs.map((state) => `${state.createdAt ?? ''}`));
        if (`${sm.quickMenuSelectedStateKey ?? ''}`.length > 0 && !quickConfigKeys.has(`${sm.quickMenuSelectedStateKey}`)) {
            sm.quickMenuSelectedStateKey = null;
        }
        for (const state of quickConfigs) {
            const button = sm.createElementWithClassList('button', 'sd-webui-sm-quick-config-item');
            const stateKey = `${state.createdAt ?? ''}`;
            const name = `${state.name ?? ''}`.trim();
            const fallbackDate = new Date(Number(state.createdAt ?? Date.now())).toISOString().replace('T', ' ').replace(/\.\d+Z/, '');
            button.type = 'button';
            button.title = name.length > 0 ? name : `Config ${fallbackDate}`;
            button.setAttribute('aria-label', button.title);
            button.dataset['tooltip'] = button.title;
            button.dataset['stateKey'] = stateKey;
            button.style.backgroundImage = state.preview ? `url("${state.preview}")` : '';
            button.classList.toggle('active', `${sm.quickMenuSelectedStateKey ?? ''}` == stateKey);
            const selectQuickConfig = (event) => {
                event.preventDefault();
                event.stopPropagation();
                sm.hideQuickConfigHoverTooltip?.();
                sm.quickMenuSelectedStateKey = stateKey;
                sm.syncQuickConfigMenuSelectionState?.();
            };
            const showQuickConfigTooltip = () => {
                sm.showQuickConfigHoverTooltip?.(`${button.title ?? ''}`, button);
            };
            const hideQuickConfigTooltip = () => {
                sm.hideQuickConfigHoverTooltip?.();
            };
            button.addEventListener('pointerdown', selectQuickConfig);
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
            button.addEventListener('keydown', (event) => {
                if (event.key == 'Enter' || event.key == ' ') {
                    selectQuickConfig(event);
                }
            });
            button.addEventListener('mouseenter', showQuickConfigTooltip);
            button.addEventListener('focus', showQuickConfigTooltip);
            button.addEventListener('mouseleave', hideQuickConfigTooltip);
            button.addEventListener('blur', hideQuickConfigTooltip);
            container.appendChild(button);
        }
        sm.syncQuickConfigApplyButtonState?.();
    };
    sm.syncSmallViewAccordionState = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        const inspector = sm.inspector || null;
        const settingsPanel = sm.panelContainer?.querySelector('.sd-webui-sm-settings-panel');
        const isModal = Boolean(sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel'));
        const isCollapsed = !isModal && Boolean(sm.uiSettings.collapseSmallViewAccordion);
        const showSettings = sm.activePanelTab == 'settings';
        if (sm.sidePanel) {
            sm.sidePanel.classList.toggle('sd-webui-sm-small-view-collapsed', isCollapsed);
        }
        if (entryContainer) {
            entryContainer.style.display = (showSettings || isCollapsed) ? 'none' : '';
        }
        if (inspector) {
            inspector.style.display = (showSettings || isCollapsed) ? 'none' : '';
        }
        if (settingsPanel) {
            settingsPanel.style.display = (!isCollapsed && showSettings) ? 'block' : 'none';
        }
        const panelTabButtons = sm.panelTabButtons || {};
        for (const tabName in panelTabButtons) {
            panelTabButtons[tabName].style.display = isCollapsed ? 'none' : '';
        }
        const toggleButton = (sm.smallViewAccordionToggleButton || null);
        if (toggleButton) {
            toggleButton.classList.toggle('open', !isCollapsed);
            toggleButton.title = isCollapsed ? 'Expand small view' : 'Collapse small view';
            toggleButton.setAttribute('aria-label', toggleButton.title);
            toggleButton.setAttribute('aria-expanded', `${!isCollapsed}`);
            toggleButton.dataset['collapsed'] = `${isCollapsed}`;
        }
        sm.renderQuickConfigMenu?.();
        sm.syncQuickConfigApplyButtonState?.();
    };
    sm.canProceedWithApplyAction = function () {
        if (!sm.uiSettings.preventApplyWithUnsavedConfigEdits) {
            return true;
        }
        const draft = sm.activeProfileDraft || null;
        if (!draft || !draft.dirty) {
            return true;
        }
        alert("You have unsaved config changes. Save or discard them before applying settings.");
        return false;
    };
    sm.applyDefaultOpenTab = function () {
        const defaultOpenTab = sm.getNormalisedPanelTabValue(sm.uiSettings.defaultOpenTab);
        sm.activePanelTab = defaultOpenTab;
        if (defaultOpenTab == 'history' || defaultOpenTab == 'favourites') {
            sm.entryFilter.group = defaultOpenTab;
        }
        sm.syncEntryFilterControls?.();
        sm.syncPanelTabButtons?.();
        sm.syncPanelTabVisibility?.();
    };
    sm.applyLoadedPreferences = function () {
        const defaults = sm.getDefaultEntryFilter();
        const rememberedFilter = sm.uiSettings.rememberFilters ? sm.getNormalisedStoredEntryFilter(sm.loadedEntryFilter) : null;
        sm.entryFilter.group = rememberedFilter?.group ?? defaults.group;
        sm.entryFilter.types = [...(rememberedFilter?.types ?? defaults.types)];
        sm.entryFilter.query = rememberedFilter?.query ?? defaults.query;
        sm.entryFilter.sort = rememberedFilter?.sort ?? defaults.sort;
        sm.entryFilter.showFavouritesInHistory = rememberedFilter?.showFavouritesInHistory ?? defaults.showFavouritesInHistory;
        sm.applyDefaultOpenTab();
        sm.syncUISettingsControls();
        sm.syncEntryFilterControls();
        sm.syncNavTabOrder?.();
        sm.syncPanelTabButtons?.();
        sm.syncPanelTabVisibility?.();
        sm.syncSearchRowVisibility?.();
        sm.syncEntryFooterVisibility?.();
        sm.syncConfigCardNameVisibility?.();
        sm.syncConfigTypeBadgeVisibility?.();
        sm.syncSmallViewAccordionState?.();
        sm.syncPaginationInteractionState?.();
        if (sm.panelContainer) {
            sm.queueEntriesUpdate(0);
        }
    };
    sm.loadPreferences = function () {
        sm.ldb.get(uiSettingsStorageKey, uiSettings => {
            sm.uiSettings = sm.getNormalisedUISettings(uiSettings);
            if (!sm.uiSettings.rememberFilters) {
                sm.loadedEntryFilter = null;
                sm.ldb.delete(entryFilterStorageKey);
                sm.applyLoadedPreferences();
                return;
            }
            sm.ldb.get(entryFilterStorageKey, entryFilter => {
                sm.loadedEntryFilter = sm.getNormalisedStoredEntryFilter(entryFilter);
                sm.applyLoadedPreferences();
            });
        });
    };
    sm.entryFilter = {
        ...sm.getDefaultEntryFilter(),
        matches: function (data) {
            const f = sm.entryFilter;
            // const q = f.query.toLowerCase();
            const queries = f.query.toLowerCase().split(/, */);
            const isFavourite = (data.groups?.indexOf('favourites') ?? -1) > -1;
            const showEntryInHistory = f.group != 'history' || f.showFavouritesInHistory || !isFavourite;
            const quickSettings = (data.quickSettings && typeof data.quickSettings === 'object') ? data.quickSettings : {};
            const checkpointName = `${quickSettings['Stable Diffusion checkpoint'] ?? quickSettings['sd_model_checkpoint'] ?? ''}`.toLowerCase();
            const sampler = `${data.generationSettings?.sampler ?? ''}`.toLowerCase();
            const prompt = `${data.generationSettings?.prompt ?? ''}`.toLowerCase();
            const negativePrompt = `${data.generationSettings?.negativePrompt ?? ''}`.toLowerCase();
            const historySearchText = f.group == 'history' ? sm.collectSearchableEntryText(data) : '';
            const historySearchName = `${data.name ?? ''}`.toLowerCase();
            return (data.groups?.indexOf(f.group) ?? -1) > -1 && f.types.indexOf(data.type) > -1 &&
                showEntryInHistory &&
                (f.query == '' || queries.every(q => checkpointName.indexOf(q) > -1 || sampler.indexOf(q) > -1 ||
                    prompt.indexOf(q) > -1 || negativePrompt.indexOf(q) > -1 ||
                    historySearchName.indexOf(q) > -1 || historySearchText.indexOf(q) > -1));
        }
    };
    sm.loadPreferences();
    sm.currentPage = 0;
    sm.queueEntriesUpdate = function (delayMs = 0) {
        if (updateEntriesDebounceHandle != null) {
            clearTimeout(updateEntriesDebounceHandle);
            updateEntriesDebounceHandle = null;
        }
        if (delayMs <= 0) {
            sm.updateEntries();
            return;
        }
        updateEntriesDebounceHandle = window.setTimeout(() => {
            updateEntriesDebounceHandle = null;
            sm.updateEntries();
        }, delayMs);
    };
    sm.queueStorageUpdate = function (delayMs = updateStorageDebounceMs) {
        if (updateStorageDebounceHandle != null) {
            clearTimeout(updateStorageDebounceHandle);
            updateStorageDebounceHandle = null;
        }
        if (delayMs <= 0) {
            sm.updateStorage();
            return;
        }
        updateStorageDebounceHandle = window.setTimeout(() => {
            updateStorageDebounceHandle = null;
            sm.updateStorage();
        }, delayMs);
    };
    sm.getNormalisedInspectorState = function (state) {
        const inspectorState = (state.inspectorState && typeof state.inspectorState === 'object') ? state.inspectorState : {};
        const checkboxes = (inspectorState.checkboxes && typeof inspectorState.checkboxes === 'object') ? inspectorState.checkboxes : {};
        return {
            checkboxes: { ...checkboxes }
        };
    };
    sm.areBooleanMapsEqual = function (a, b) {
        const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
        const getCheckboxState = (source, key) => source?.hasOwnProperty(key) ? Boolean(source[key]) : true;
        for (const key of keys) {
            if (getCheckboxState(a, key) !== getCheckboxState(b, key)) {
                return false;
            }
        }
        return true;
    };
    sm.ensureActiveProfileDraft = function (entry) {
        const stateKey = `${entry.data.createdAt ?? ''}`;
        if (sm.activeProfileDraft?.stateKey === stateKey) {
            return sm.activeProfileDraft;
        }
        const originalInspectorState = sm.getNormalisedInspectorState(entry.data);
        const isFavourite = (entry.data.groups?.indexOf('favourites') ?? -1) > -1 || sm.entryFilter.group == 'favourites';
        sm.activeProfileDraft = {
            stateKey,
            originalName: `${entry.data.name ?? ''}`,
            name: `${entry.data.name ?? ''}`,
            originalIsFavourite: isFavourite,
            isFavourite,
            originalInspectorState,
            inspectorState: {
                checkboxes: { ...originalInspectorState.checkboxes },
            },
            dirty: false
        };
        return sm.activeProfileDraft;
    };
    sm.refreshActiveProfileDraftState = function () {
        const draft = sm.activeProfileDraft || null;
        if (!draft) {
            return;
        }
        const canSaveConfigChanges = draft.originalIsFavourite || sm.entryFilter.group == 'favourites';
        const hasNameChanges = `${draft.name ?? ''}` !== `${draft.originalName ?? ''}`;
        const hasFavouriteChanges = draft.isFavourite !== draft.originalIsFavourite;
        const hasCheckboxChanges = !sm.areBooleanMapsEqual(draft.inspectorState.checkboxes || {}, draft.originalInspectorState.checkboxes || {});
        draft.dirty = hasNameChanges || hasFavouriteChanges || hasCheckboxChanges;
        if (!canSaveConfigChanges) {
            draft.dirty = false;
        }
        if (Array.isArray(sm.activeProfileSaveButtons)) {
            for (const button of sm.activeProfileSaveButtons) {
                button.disabled = !canSaveConfigChanges;
            }
        }
    };
    sm.getActiveProfileCheckboxState = function (settingKey, defaultValue = true) {
        const draft = sm.activeProfileDraft || null;
        if (!draft || !settingKey) {
            return defaultValue;
        }
        if (draft.inspectorState.checkboxes.hasOwnProperty(settingKey)) {
            return Boolean(draft.inspectorState.checkboxes[settingKey]);
        }
        return defaultValue;
    };
    sm.setActiveProfileCheckboxState = function (settingKey, value) {
        const draft = sm.activeProfileDraft || null;
        if (!draft || !settingKey) {
            return;
        }
        if (value) {
            delete draft.inspectorState.checkboxes[settingKey];
        }
        else {
            draft.inspectorState.checkboxes[settingKey] = false;
        }
        sm.refreshActiveProfileDraftState();
    };
    sm.confirmDiscardPendingProfileChanges = function () {
        const draft = sm.activeProfileDraft || null;
        if (!draft || !draft.dirty) {
            return true;
        }
        const shouldDiscard = confirm("You have unsaved config changes. Discard them and continue?");
        if (shouldDiscard) {
            sm.activeProfileDraft = null;
        }
        return shouldDiscard;
    };
    sm.getGroupsWithFavouriteState = function (groups, isFavourite) {
        const groupSet = new Set(groups || []);
        if (isFavourite) {
            groupSet.add('favourites');
        }
        else {
            groupSet.delete('favourites');
        }
        if (groupSet.size == 0) {
            groupSet.add('history');
        }
        return Array.from(groupSet);
    };
    sm.upsertState = function (state) {
        const stateClone = JSON.parse(JSON.stringify(state));
        stateClone.createdAt = Date.now();
        while (sm.memoryStorage.entries.data.hasOwnProperty(`${stateClone.createdAt}`)) {
            stateClone.createdAt++;
        }
        sm.memoryStorage.entries.data[stateClone.createdAt] = stateClone;
        sm.memoryStorage.entries.updateKeys();
        if ((stateClone.groups?.indexOf('favourites') ?? -1) > -1) {
            sm.appendFavouritesOrderKey?.(`${stateClone.createdAt}`);
        }
        sm.updateStorage();
        return stateClone;
    };
    sm.getConfigVersionBaseId = function (state, stateKey = '') {
        const explicitVersionId = `${state?.configVersionId ?? ''}`.trim();
        if (explicitVersionId.length > 0) {
            return explicitVersionId;
        }
        const fallbackId = `${stateKey || (state?.createdAt ?? '')}`.trim();
        return fallbackId.length > 0 ? fallbackId : `${Date.now()}`;
    };
    sm.getConfigVersionNumber = function (state) {
        const versionNumber = Number.parseInt(`${state?.configVersionNumber ?? ''}`);
        return Number.isFinite(versionNumber) && versionNumber > 0 ? versionNumber : 1;
    };
    sm.isHistoryVersionPreviewMode = function () {
        return sm.activePanelTab == 'history' && sm.entryFilter.group == 'history' && `${sm.historyVersionContext?.configVersionId ?? ''}`.trim().length > 0;
    };
    sm.syncHistoryVersionContextFromSelection = function () {
        const selectedEntries = sm.selection?.entries || [];
        if (selectedEntries.length != 1 || !selectedEntries[0]?.data) {
            sm.historyVersionContext = { configVersionId: '' };
            return;
        }
        const selectedState = selectedEntries[0].data;
        const selectedStateKey = `${selectedState.createdAt ?? ''}`;
        sm.historyVersionContext = {
            configVersionId: sm.getConfigVersionBaseId(selectedState, selectedStateKey)
        };
    };
    sm.getSamplerDisplayValue = function (state) {
        const generationType = `${state?.type ?? ''}`;
        const componentSettings = (state?.componentSettings && typeof state.componentSettings === 'object') ? state.componentSettings : {};
        const candidatePaths = [
            `${generationType}/Sampling method`,
            `${generationType}/Sampling Method`,
            `customscript/sampler.py/${generationType}/Sampling Method`
        ];
        for (const candidatePath of candidatePaths) {
            if (!componentSettings.hasOwnProperty(candidatePath)) {
                continue;
            }
            const samplerValue = `${componentSettings[candidatePath] ?? ''}`.trim();
            if (samplerValue.length > 0) {
                return samplerValue;
            }
        }
        return `${state?.generationSettings?.sampler ?? ''}`.trim();
    };
    sm.buildStateComparableMap = function (state) {
        const comparableMap = {};
        const appendComparableValues = (prefix, values) => {
            if (!values || typeof values !== 'object') {
                return;
            }
            for (const [key, value] of Object.entries(values)) {
                comparableMap[`${prefix}/${key}`] = `${value ?? ''}`;
            }
        };
        appendComparableValues('quick', state?.quickSettings);
        appendComparableValues('component', state?.componentSettings);
        return comparableMap;
    };
    sm.getStateChangeDetails = function (previousState, nextState) {
        const previousComparable = sm.buildStateComparableMap(previousState);
        const nextComparable = sm.buildStateComparableMap(nextState);
        let changedFieldsCount = 0;
        const allComparableKeys = new Set([...Object.keys(previousComparable), ...Object.keys(nextComparable)]);
        for (const comparableKey of allComparableKeys) {
            if (`${previousComparable[comparableKey] ?? ''}` !== `${nextComparable[comparableKey] ?? ''}`) {
                changedFieldsCount++;
            }
        }
        const previousSampler = sm.getSamplerDisplayValue(previousState);
        const nextSampler = sm.getSamplerDisplayValue(nextState);
        let summary = '';
        if (previousSampler.length > 0 && nextSampler.length > 0 && previousSampler !== nextSampler) {
            summary = `sampler: ${previousSampler} -> ${nextSampler}`;
        }
        else {
            summary = `${changedFieldsCount} field${changedFieldsCount == 1 ? '' : 's'} changed`;
        }
        return {
            changedFieldsCount,
            summary
        };
    };
    sm.createConfigVersionHistoryEntry = function (previousState, versionId, versionNumber, changeSummary) {
        const historyEntry = JSON.parse(JSON.stringify(previousState || {}));
        historyEntry.groups = sm.getGroupsWithFavouriteState(previousState?.groups || ['history'], false);
        historyEntry.configVersionId = versionId;
        historyEntry.configVersionNumber = versionNumber;
        historyEntry.configVersionIsCurrent = false;
        historyEntry.configVersionChangeSummary = `${changeSummary ?? ''}`.trim();
        historyEntry.configVersionTimestamp = Date.now();
        return historyEntry;
    };
    sm.saveActiveProfileChanges = async function () {
        if (sm.selection.entries.length != 1) {
            return;
        }
        const entry = sm.selection.entries[0];
        const draft = sm.ensureActiveProfileDraft(entry);
        const canSaveConfigChanges = draft.originalIsFavourite || sm.entryFilter.group == 'favourites';
        if (!canSaveConfigChanges) {
            return;
        }
        const hasProfileMetadataChanges = Boolean(draft.dirty);
        const entryStateKey = `${entry.data.createdAt ?? ''}`;
        const wasFavourite = (entry.data.groups?.indexOf('favourites') ?? -1) > -1;
        const previousState = JSON.parse(JSON.stringify(entry.data || {}));
        const assignDraftData = (targetState, baseGroups) => {
            const finalName = `${draft.name ?? ''}`.trim();
            if (finalName.length > 0) {
                targetState.name = finalName;
            }
            else {
                delete targetState.name;
            }
            targetState.groups = sm.getGroupsWithFavouriteState(baseGroups, draft.isFavourite);
            targetState.inspectorState = {
                checkboxes: { ...(draft.inspectorState.checkboxes || {}) }
            };
        };
        let updatedState = null;
        try {
            updatedState = await sm.getCurrentState(entry.data.type);
        }
        catch (e) {
            sm.utils.logResponseError("[State Manager] Failed to collect current UI state for config overwrite", e);
            return;
        }
        if (!updatedState || typeof updatedState !== 'object') {
            return;
        }
        assignDraftData(updatedState, entry.data.groups || []);
        updatedState.createdAt = entry.data.createdAt;
        const isFavourite = (updatedState.groups?.indexOf('favourites') ?? -1) > -1;
        const configVersionId = sm.getConfigVersionBaseId(entry.data, entryStateKey);
        const previousVersionNumber = sm.getConfigVersionNumber(entry.data);
        const changeDetails = sm.getStateChangeDetails(previousState, updatedState);
        if (!hasProfileMetadataChanges && changeDetails.changedFieldsCount <= 0) {
            return;
        }
        const shouldCreateVersionHistory = wasFavourite && isFavourite && changeDetails.changedFieldsCount > 0;
        if (shouldCreateVersionHistory) {
            const historyVersionEntry = sm.createConfigVersionHistoryEntry(previousState, configVersionId, previousVersionNumber, changeDetails.summary);
            sm.upsertState(historyVersionEntry);
            updatedState.configVersionId = configVersionId;
            updatedState.configVersionNumber = previousVersionNumber + 1;
            updatedState.configVersionIsCurrent = true;
            updatedState.configVersionChangeSummary = changeDetails.summary;
            updatedState.configVersionTimestamp = Date.now();
        }
        else {
            const hasExistingVersionId = `${entry.data?.configVersionId ?? ''}`.trim().length > 0;
            updatedState.configVersionId = hasExistingVersionId ? `${entry.data.configVersionId}` : configVersionId;
            updatedState.configVersionNumber = sm.getConfigVersionNumber(entry.data);
            updatedState.configVersionIsCurrent = isFavourite && Boolean(entry.data?.configVersionIsCurrent ?? wasFavourite);
            updatedState.configVersionChangeSummary = `${entry.data?.configVersionChangeSummary ?? ''}`;
            updatedState.configVersionTimestamp = Number(entry.data?.configVersionTimestamp ?? entry.data?.createdAt ?? Date.now());
        }
        sm.memoryStorage.entries.data[entryStateKey] = updatedState;
        entry.data = updatedState;
        if (!wasFavourite && isFavourite) {
            sm.appendFavouritesOrderKey?.(entryStateKey);
        }
        else if (wasFavourite && !isFavourite) {
            sm.removeFavouritesOrderKey?.(entryStateKey);
        }
        sm.activeProfileDraft = null;
        sm.updateStorage();
        sm.updateEntryIndicators(entry);
        sm.updateEntries();
        sm.updateInspector();
    };
    sm.getEntriesPerPage = function () {
        if (sm.getMode() == 'modal') {
            return modalEntriesPerPage;
        }
        if (sm.isSmallViewMode()) {
            const entriesSetting = sm.entryFilter.group == 'favourites'
                ? sm.uiSettings.favouritesSmallViewEntriesPerPage
                : sm.uiSettings.historySmallViewEntriesPerPage;
            return Math.max(1, Number.parseInt(`${entriesSetting ?? ''}`) || entriesPerPage);
        }
        return entriesPerPage;
    };
    sm.ensurePreviewObserver = function (root) {
        if (sm.previewObserver || typeof IntersectionObserver === 'undefined') {
            return;
        }
        sm.previewObserver = new IntersectionObserver((entries) => {
            for (const observerEntry of entries) {
                if (!observerEntry.isIntersecting) {
                    continue;
                }
                const targetEntry = observerEntry.target;
                sm.previewObserver?.unobserve(targetEntry);
                const previewSrc = `${targetEntry.dataset['previewSrc'] ?? ''}`;
                if (previewSrc.length == 0) {
                    continue;
                }
                sm.applyEntryPreview(targetEntry, previewSrc);
            }
        }, {
            root,
            rootMargin: previewObserverRootMargin
        });
    };
    sm.clearEntryPreview = function (entry) {
        sm.previewObserver?.unobserve(entry);
        delete entry.dataset['previewSrc'];
        delete entry.dataset['previewLoaded'];
        entry.style.backgroundImage = '';
    };
    sm.applyEntryPreview = function (entry, previewSrc) {
        const applyIfCurrent = () => {
            if (`${entry.dataset['previewSrc'] ?? ''}` !== previewSrc) {
                return;
            }
            entry.style.backgroundImage = `url("${previewSrc}")`;
            entry.dataset['previewLoaded'] = previewSrc;
            loadedPreviewUrls.add(previewSrc);
        };
        if (loadedPreviewUrls.has(previewSrc)) {
            applyIfCurrent();
            return;
        }
        const preloadedImage = new Image();
        preloadedImage.onload = applyIfCurrent;
        preloadedImage.onerror = applyIfCurrent;
        preloadedImage.src = previewSrc;
    };
    sm.queueEntryPreview = function (entry, previewSrc) {
        entry.dataset['previewSrc'] = previewSrc;
        if (`${entry.dataset['previewLoaded'] ?? ''}` === previewSrc) {
            entry.style.backgroundImage = `url("${previewSrc}")`;
            return;
        }
        entry.style.backgroundImage = '';
        if (previewSrc.length == 0) {
            return;
        }
        if (typeof IntersectionObserver === 'undefined') {
            sm.applyEntryPreview(entry, previewSrc);
            return;
        }
        const entriesRoot = sm.panelContainer?.querySelector('.sd-webui-sm-entries');
        if (!entriesRoot) {
            sm.applyEntryPreview(entry, previewSrc);
            return;
        }
        sm.ensurePreviewObserver(entriesRoot);
        sm.previewObserver?.observe(entry);
    };
    sm.syncModalOverlayState = function () {
        const isModalOpen = Boolean(sm.panelContainer?.classList.contains('sd-webui-sm-modal-panel') && sm.panelContainer?.classList.contains('open'));
        document.body.classList.toggle('sd-webui-sm-modal-open', isModalOpen);
    };
    sm.getSavedUiPreviewImagePath = function () {
        if (typeof sm.savedUiPreviewImagePath === 'string' && sm.savedUiPreviewImagePath.length > 0) {
            return sm.savedUiPreviewImagePath;
        }
        const scriptSource = Array
            .from(document.querySelectorAll('script[src]'))
            .map((script) => `${script.src ?? ''}`)
            .find((src) => /\/javascript\/[^/]*statemanager[^/]*\.js(?:\?|$)/i.test(src));
        if (scriptSource) {
            sm.savedUiPreviewImagePath = scriptSource.replace(/\/javascript\/[^/?#]+\.js(?:[?#].*)?$/i, '/resources/icon-saved-ui.webp');
            return sm.savedUiPreviewImagePath;
        }
        const stackMatch = new Error().stack?.match((/(http(.)+)\/javascript\/[^/]+\.js/));
        if (stackMatch) {
            sm.savedUiPreviewImagePath = `${stackMatch[1]}/resources/icon-saved-ui.webp`;
            return sm.savedUiPreviewImagePath;
        }
        return null;
    };
    sm.captureInspectorAccordionState = function () {
        if (!sm.inspector) {
            return;
        }
        sm.inspectorAccordionState = sm.inspectorAccordionState || {};
        for (const accordion of sm.inspector.querySelectorAll('.sd-webui-sm-inspector-category')) {
            const sectionLabel = `${accordion.querySelector('.label')?.textContent ?? ''}`.trim();
            if (sectionLabel.length > 0) {
                sm.inspectorAccordionState[sectionLabel] = accordion.classList.contains('open');
            }
        }
    };
    sm.injectUI = function () {
        // I really want to reuse some of the generated `svelte-xxxxxx` components, but these names have been known to change in the past (https://github.com/AUTOMATIC1111/stable-diffusion-webui/discussions/10076)
        // To get around this, we find the target elements and extract the classname for this version of the app.
        // It's still fragile af, just... slightly less so?
        // @ts-ignore
        const svelteClassFromSelector = selector => Array.from(Array.from(app.querySelectorAll(selector)).find(el => Array.from(el.classList).flat().find(cls => cls.startsWith('svelte-'))).classList).find(cls => cls.startsWith('svelte-'));
        sm.svelteClasses = {
            button: svelteClassFromSelector('.lg.secondary.gradio-button.tool'),
            tab: svelteClassFromSelector('#tabs'),
            checkbox: svelteClassFromSelector('input[type=checkbox]'),
            prompt: svelteClassFromSelector('#txt2img_prompt label')
        };
        const defaultQuickSettingSaveButtonText = 'Save Current UI as Config';
        const quickSettingSaveButton = sm.createElementWithInnerTextAndClassList('button', defaultQuickSettingSaveButtonText, 'sd-webui-sm-nav-save-button', 'sd-webui-sm-nav-save-current-config-button', 'lg', 'secondary', 'gradio-button', sm.svelteClasses.button);
        quickSettingSaveButton.id = 'sd-webui-sm-quicksettings-button-save';
        quickSettingSaveButton.title = "Save current UI settings as a config";
        sm.quickSettingSaveButton = quickSettingSaveButton;
        const showQuickSettingSaveButtonResult = (success) => {
            quickSettingSaveButton.innerText = success ? 'Saved' : 'Save Failed';
            quickSettingSaveButton.classList.toggle('sd-webui-sm-shake', !success);
            setTimeout(() => {
                quickSettingSaveButton.innerText = defaultQuickSettingSaveButtonText;
                quickSettingSaveButton.classList.remove('sd-webui-sm-shake');
            }, 1600);
        };
        quickSettingSaveButton.addEventListener('click', async () => {
            const generationType = sm.utils.getCurrentGenerationTypeFromUI();
            if (generationType != null) {
                const currentState = await sm.getCurrentState(generationType);
                currentState.name = "Saved UI " + new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, '');
                currentState.isUiSaveConfig = true;
                const savedUiPreviewPath = sm.getSavedUiPreviewImagePath();
                if (savedUiPreviewPath) {
                    currentState.preview = savedUiPreviewPath;
                }
                sm.saveState(currentState, 'favourites');
                showQuickSettingSaveButtonResult(true);
                sm.updateEntries();
            }
            else {
                showQuickSettingSaveButtonResult(false);
            }
        });
        sm.panelContainer = sm.createElementWithClassList('div', 'sd-webui-sm-panel-container');
        const panel = sm.createElementWithClassList('div', 'sd-webui-sm-side-panel');
        sm.sidePanel = panel;
        if (sm.hasOwnProperty('legacyData')) {
            panel.classList.add('sd-webui-sm-side-panel-legacy');
            const infoDiv = sm.createElementWithClassList('div', 'sd-webui-sm-info');
            infoDiv.appendChild(sm.createElementWithInnerTextAndClassList('h1', "⚠️ Warning ⚠️"));
            const messageDiv = sm.createElementWithClassList('div');
            messageDiv.innerHTML = " \
            You are currently using State Manager 2.0, but your localstorage contains saved data from the previous version. Unfortunately, the two are not compatible. \
            <br><br> \
            If you wish to continue using this new version, you will lose your old saved states. If you want, you can click the button below to first export your existing data to a somewhat human-readable format and store in it a file for future reference. \
            <br><br> \
            If you would prefer to go back to version 1.0, you can either: \
            <br><br> \
            <ul> \
            <li>Go to <a href='https://github.com/dane-9/sd-webui-state-manager-continued'>the State Manager GitHub page</a>, select the <pre>V1.0-legacy</pre> branch, download the zip, and replace the <pre>sd-webui/extensions/sd-webui-state-manager</pre> folder with it.</li> \
            <li>Open a terminal, navigate (<pre>cd</pre>) to your <pre>sd-webui/extensions/sd-webui-state-manager</pre> folder, and run <pre>git checkout V1.0-legacy</pre>.</li> \
            </ul> \
            ";
            infoDiv.appendChild(messageDiv);
            const buttonContainer = sm.createElementWithClassList('div', 'sd-webui-sm-button-container');
            const exportButton = sm.createElementWithInnerTextAndClassList('button', "Export old save data to JSON file");
            exportButton.addEventListener('click', () => {
                sm.api.post("exportlegacy", { contents: JSON.stringify(sm.legacyData) })
                    .then(response => {
                    if (!sm.utils.isValidResponse(response, 'success', 'path') || !response.success) {
                        Promise.reject(response);
                        return;
                    }
                    alert(`Success! The save data was succesfully exported to ${response.path}`);
                })
                    .catch(e => alert(`There was an error exporting the data: ${e}`));
            });
            const continueButton = sm.createElementWithInnerTextAndClassList('button', "Delete old save data and refresh the page (this cannot be undone!)");
            continueButton.addEventListener('click', () => {
                sm.ldb.delete('sd-webui-state-manager-data', () => location.reload());
            });
            buttonContainer.appendChild(exportButton);
            buttonContainer.appendChild(continueButton);
            infoDiv.appendChild(buttonContainer);
            panel.appendChild(infoDiv);
            sm.panelContainer.appendChild(panel);
            sm.mountPanelContainer();
            sm.panelContainer.classList.add('sd-webui-sm-modal-panel');
            sm.panelContainer.classList.add('open');
            sm.syncModalOverlayState();
            return;
        }
        const nav = sm.createElementWithClassList('div', 'sd-webui-sm-navigation');
        sm.inspector = sm.createElementWithClassList('div', 'sd-webui-sm-inspector');
        // Tabs
        const navTabs = sm.createElementWithClassList('div', 'tabs', 'gradio-tabs', sm.svelteClasses.tab);
        let showSavedConfigsToggle = null;
        let settingsPanel = null;
        let navControlButtons = null;
        const panelTabButtons = {};
        const updateShowSavedConfigsToggleVisibility = () => {
            if (showSavedConfigsToggle) {
                showSavedConfigsToggle.style.display = sm.activePanelTab == 'history' ? '' : 'none';
            }
        };
        const setActivePanelTab = (tab, group) => {
            const previousTab = sm.activePanelTab;
            sm.activePanelTab = tab;
            sm.syncPanelTabButtons?.();
            sm.syncPanelTabVisibility?.();
            updateShowSavedConfigsToggleVisibility();
            if (tab == 'history' && previousTab == 'favourites') {
                sm.syncHistoryVersionContextFromSelection?.();
            }
            if (group) {
                sm.entryFilter.group = group;
                sm.persistEntryFilterIfEnabled();
                sm.queueEntriesUpdate(updateEntriesDebounceMs);
            }
        };
        function createNavTab(label, tab, group, isSelected) {
            const button = sm.createElementWithInnerTextAndClassList('button', label, sm.svelteClasses.tab);
            button.dataset['smTab'] = tab;
            panelTabButtons[tab] = button;
            if (isSelected) {
                button.classList.add('selected');
            }
            navTabs.appendChild(button);
            button.addEventListener('click', () => {
                setActivePanelTab(tab, group ?? undefined);
            });
        }
        createNavTab('History', 'history', 'history', true);
        createNavTab('Configs', 'favourites', 'favourites');
        createNavTab('Settings', 'settings', null);
        sm.panelTabButtons = panelTabButtons;
        navControlButtons = sm.createElementWithClassList('div', 'sd-webui-sm-control');
        const quickConfigMenuContainer = sm.createElementWithClassList('div', 'sd-webui-sm-quick-config-menu');
        sm.quickConfigMenuContainer = quickConfigMenuContainer;
        navControlButtons.appendChild(quickConfigMenuContainer);
        const quickConfigApplyButton = sm.createElementWithInnerTextAndClassList('button', 'Apply Config', 'sd-webui-sm-nav-save-button', 'sd-webui-sm-nav-apply-config-button', 'lg', 'secondary', 'gradio-button', sm.svelteClasses.button);
        quickConfigApplyButton.disabled = true;
        quickConfigApplyButton.classList.add('sd-webui-sm-hidden');
        quickConfigApplyButton.addEventListener('click', () => sm.applyQuickSelectedConfig?.());
        sm.quickConfigApplyButton = quickConfigApplyButton;
        navControlButtons.appendChild(quickConfigApplyButton);
        navControlButtons.appendChild(quickSettingSaveButton);
        const navButtonMode = sm.createElementWithClassList('button', 'sd-webui-sm-inspector-mode');
        navControlButtons.appendChild(navButtonMode);
        const navButtonSmallViewAccordion = sm.createElementWithClassList('button', 'sd-webui-sm-small-view-accordion-toggle', 'gradio-accordion');
        navButtonSmallViewAccordion.appendChild(sm.createElementWithInnerTextAndClassList('span', '▼', 'foldout'));
        sm.smallViewAccordionToggleButton = navButtonSmallViewAccordion;
        navControlButtons.appendChild(navButtonSmallViewAccordion);
        navButtonMode.addEventListener('click', () => {
            panel.classList.remove('sd-webui-sm-side-panel-folded');
            sm.panelContainer.classList.add('sd-webui-sm-modal-panel');
            sm.mountPanelContainer();
            sm.syncModalOverlayState();
            sm.updateInspector();
        });
        navButtonSmallViewAccordion.addEventListener('click', () => {
            if (sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) {
                return;
            }
            sm.uiSettings.collapseSmallViewAccordion = !Boolean(sm.uiSettings.collapseSmallViewAccordion);
            sm.saveUISettings();
            sm.syncSmallViewAccordionState?.();
            sm.syncPaginationInteractionState?.();
            sm.queueEntriesUpdate(0);
        });
        panel.addEventListener('click', e => e.stopPropagation());
        sm.panelContainer.addEventListener('click', () => {
            if (sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) {
                sm.panelContainer.classList.remove('sd-webui-sm-modal-panel');
                sm.mountPanelContainer();
                sm.syncModalOverlayState();
                sm.updateInspector();
            }
        });
        const navButtonClose = sm.createElementWithInnerTextAndClassList('button', '✖', 'sd-webui-sm-modal-close-button');
        navControlButtons.appendChild(navButtonClose);
        navButtonClose.addEventListener('click', () => {
            if (!sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) {
                return;
            }
            sm.panelContainer.classList.remove('sd-webui-sm-modal-panel');
            sm.mountPanelContainer();
            sm.syncModalOverlayState();
            sm.updateInspector();
        });
        navTabs.appendChild(navControlButtons);
        sm.syncNavTabOrder = function () {
            if (!navControlButtons) {
                return;
            }
            const orderedTabs = sm.uiSettings.showConfigsFirst
                ? ['favourites', 'history', 'settings']
                : ['history', 'favourites', 'settings'];
            for (const tabName of orderedTabs) {
                const tabButton = panelTabButtons[tabName];
                if (tabButton) {
                    navTabs.insertBefore(tabButton, navControlButtons);
                }
            }
        };
        nav.appendChild(navTabs);
        // Entry container
        const entryContainer = sm.createElementWithClassList('div', 'sd-webui-sm-entry-container');
        // Search + pagination
        const entryHeader = sm.createElementWithClassList('div', 'sd-webui-sm-entry-header');
        const searchRow = sm.createElementWithClassList('div', 'sd-webui-sm-entry-toolbar-row', 'search-row');
        const filterRow = sm.createElementWithClassList('div', 'sd-webui-sm-entry-toolbar-row', 'filter-row');
        const search = sm.createElementWithClassList('input');
        search.type = 'text';
        search.placeholder = "Filter by name, tokens, model or sampler";
        search.value = sm.entryFilter.query;
        const searchChangeCallback = (debounce = true) => {
            sm.entryFilter.query = search.value;
            if (!debounce) {
                sm.persistEntryFilterIfEnabled();
            }
            sm.queueEntriesUpdate(debounce ? updateEntriesDebounceMs : 0);
        };
        search.addEventListener('input', searchChangeCallback);
        search.addEventListener('change', () => searchChangeCallback(false));
        searchRow.appendChild(sm.createElementWithInnerTextAndClassList('span', '🔍', 'sd-webui-sm-icon'));
        searchRow.appendChild(search);
        const entryFooter = sm.createElementWithClassList('div', 'sd-webui-sm-entry-footer');
        sm.pageButtonNavigation = sm.createElementWithClassList('div', 'button-navigation');
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '❮❮', 'jump-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '❮', 'jump-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '8', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '9', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '10', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '11', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '12', 'number-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '❯', 'jump-button'));
        sm.pageButtonNavigation.appendChild(sm.createElementWithInnerTextAndClassList('button', '❯❯', 'jump-button'));
        // <<
        sm.pageButtonNavigation.childNodes[0].addEventListener('click', () => sm.goToPage(0));
        sm.pageButtonNavigation.childNodes[1].addEventListener('click', () => sm.goToPage(Math.max(sm.currentPage - 1, 0)));
        const textNavigation = sm.createElementWithClassList('div', 'text-navigation');
        textNavigation.appendChild(sm.createElementWithInnerTextAndClassList('span', 'Page'));
        sm.pageNumberInput = document.createElement('input');
        sm.pageNumberInput.type = 'number';
        sm.pageNumberInput.min = 1;
        sm.pageNumberInput.max = 999;
        sm.pageNumberInput.value = 1;
        sm.pageNumberInput.required = true;
        textNavigation.appendChild(sm.pageNumberInput);
        sm.maxPageNumberLabel = sm.createElementWithInnerTextAndClassList('span', 'of 1');
        textNavigation.appendChild(sm.maxPageNumberLabel);
        const handlePageInput = () => {
            sm.goToPage(Math.min(Math.max(sm.pageNumberInput.value.replaceAll(/[^\d]/g, '') - 1, sm.pageNumberInput.min), sm.pageNumberInput.max) || 0);
        };
        sm.pageNumberInput.addEventListener('change', handlePageInput);
        sm.pageNumberInput.addEventListener('blur', handlePageInput);
        entryFooter.appendChild(sm.pageButtonNavigation);
        entryFooter.appendChild(textNavigation);
        function createFilterToggle(type) {
            return sm.createPillToggle(type, { title: `Show ${type} entries` }, `sd-webui-sm-filter-${type}`, sm.entryFilter.types.indexOf(type) > -1, (isOn) => {
                const typeIndex = sm.entryFilter.types.indexOf(type);
                if (isOn && typeIndex == -1) {
                    sm.entryFilter.types.push(type);
                }
                else if (!isOn && typeIndex > -1) {
                    sm.entryFilter.types.splice(typeIndex, 1);
                }
                sm.persistEntryFilterIfEnabled();
                sm.queueEntriesUpdate(updateEntriesDebounceMs);
            }, false);
        }
        filterRow.appendChild(createFilterToggle('txt2img'));
        filterRow.appendChild(createFilterToggle('img2img'));
        showSavedConfigsToggle = sm.createPillToggle('Show Saved Configs', { title: "Show saved configs in history", id: 'sd-webui-sm-filter-favourites' }, 'sd-webui-sm-filter-favourites-checkbox', sm.entryFilter.showFavouritesInHistory, (isOn) => {
            sm.entryFilter.showFavouritesInHistory = isOn;
            sm.persistEntryFilterIfEnabled();
            sm.queueEntriesUpdate(updateEntriesDebounceMs);
        }, true);
        filterRow.appendChild(showSavedConfigsToggle);
        updateShowSavedConfigsToggleVisibility();
        const sortLabel = sm.createElementWithInnerTextAndClassList('label', 'Sort');
        sortLabel.htmlFor = 'sd-webui-sm-sort';
        const sortSelect = document.createElement('select');
        sortSelect.id = 'sd-webui-sm-sort';
        sortSelect.classList.add('sd-webui-sm-sort');
        sortSelect.innerHTML = `
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
        `;
        sortSelect.value = sm.entryFilter.sort;
        sortSelect.title = 'Sort entries';
        sortSelect.addEventListener('change', () => {
            sm.entryFilter.sort = sortSelect.value;
            sm.persistEntryFilterIfEnabled();
            sm.queueEntriesUpdate(updateEntriesDebounceMs);
        });
        const reorderContainer = sm.createElementWithClassList('div', 'sd-webui-sm-reorder-container');
        const reorderToggleButton = sm.createElementWithInnerTextAndClassList('button', 'Reorder', 'sd-webui-sm-reorder-button');
        const reorderMoveLeftButton = sm.createElementWithInnerTextAndClassList('button', '←', 'sd-webui-sm-reorder-button');
        const reorderMoveRightButton = sm.createElementWithInnerTextAndClassList('button', '→', 'sd-webui-sm-reorder-button');
        const reorderSaveButton = sm.createElementWithInnerTextAndClassList('button', 'Save Order', 'sd-webui-sm-reorder-button');
        const reorderCancelButton = sm.createElementWithInnerTextAndClassList('button', 'Cancel', 'sd-webui-sm-reorder-button');
        reorderMoveLeftButton.title = 'Move selected config left';
        reorderMoveRightButton.title = 'Move selected config right';
        reorderSaveButton.title = 'Save custom config order';
        reorderCancelButton.title = 'Discard custom order changes';
        reorderContainer.appendChild(reorderToggleButton);
        reorderContainer.appendChild(reorderMoveLeftButton);
        reorderContainer.appendChild(reorderMoveRightButton);
        reorderContainer.appendChild(reorderSaveButton);
        reorderContainer.appendChild(reorderCancelButton);
        filterRow.appendChild(reorderContainer);
        const sortContainer = sm.createElementWithClassList('div', 'sd-webui-sm-sort-container');
        sortContainer.appendChild(sortLabel);
        sortContainer.appendChild(sortSelect);
        filterRow.appendChild(sortContainer);
        sm.configReorderState = sm.configReorderState || {
            active: false,
            originalOrder: [],
            workingOrder: [],
            hasChanges: false,
            previousSort: sm.entryFilter.sort
        };
        const areStringArraysEqual = (a, b) => a.length == b.length && a.every((value, index) => value == b[index]);
        sm.enterConfigReorderMode = function () {
            if (sm.configReorderState?.active || sm.activePanelTab != 'favourites') {
                return;
            }
            const baseOrder = sm.ensureFavouritesOrder();
            sm.configReorderState = {
                active: true,
                originalOrder: [...baseOrder],
                workingOrder: [...baseOrder],
                hasChanges: false,
                previousSort: sm.entryFilter.sort
            };
            sm.syncConfigReorderControlsState?.();
            sm.queueEntriesUpdate(0);
        };
        sm.moveSelectedConfigOrder = function (direction) {
            if (!sm.configReorderState?.active) {
                return;
            }
            const selectedStateKey = sm.getSelectedConfigStateKey?.();
            if (!selectedStateKey) {
                sm.syncConfigReorderControlsState?.();
                return;
            }
            const workingOrder = sm.getNormalisedFavouritesOrder(sm.configReorderState.workingOrder);
            const currentIndex = workingOrder.indexOf(selectedStateKey);
            const targetIndex = currentIndex + direction;
            if (currentIndex < 0 || targetIndex < 0 || targetIndex >= workingOrder.length) {
                sm.syncConfigReorderControlsState?.();
                return;
            }
            [workingOrder[currentIndex], workingOrder[targetIndex]] = [workingOrder[targetIndex], workingOrder[currentIndex]];
            sm.configReorderState.workingOrder = workingOrder;
            sm.configReorderState.hasChanges = !areStringArraysEqual(workingOrder, sm.configReorderState.originalOrder || []);
            sm.syncConfigReorderControlsState?.();
            sm.queueEntriesUpdate(0);
        };
        sm.saveConfigReorderChanges = function () {
            if (!sm.configReorderState?.active) {
                return;
            }
            sm.memoryStorage.favouritesOrder = sm.getNormalisedFavouritesOrder(sm.configReorderState.workingOrder);
            sm.configReorderState = {
                active: false,
                originalOrder: [],
                workingOrder: [],
                hasChanges: false,
                previousSort: sm.entryFilter.sort
            };
            sm.updateStorage();
            sm.syncConfigReorderControlsState?.();
            sm.queueEntriesUpdate(0);
        };
        sm.cancelConfigReorderChanges = function () {
            if (!sm.configReorderState?.active) {
                return;
            }
            sm.entryFilter.sort = sm.getNormalisedSortValue(sm.configReorderState.previousSort);
            sm.persistEntryFilterIfEnabled();
            sm.syncEntryFilterControls();
            sm.configReorderState = {
                active: false,
                originalOrder: [],
                workingOrder: [],
                hasChanges: false,
                previousSort: sm.entryFilter.sort
            };
            sm.syncConfigReorderControlsState?.();
            sm.queueEntriesUpdate(0);
        };
        sm.syncConfigReorderControlsState = function () {
            const isConfigsTab = sm.activePanelTab == 'favourites';
            const isActive = Boolean(sm.configReorderState?.active);

            if (!isConfigsTab && isActive) {
                sm.cancelConfigReorderChanges?.();
                return;
            }
            if (!isConfigsTab && sm.entryFilter.sort == 'manual') {
                sm.entryFilter.sort = 'newest';
                sm.persistEntryFilterIfEnabled();
                sm.syncEntryFilterControls();
            }

            const selectedStateKey = isActive ? sm.getSelectedConfigStateKey?.() : null;
            const workingOrder = sm.getNormalisedFavouritesOrder(sm.configReorderState?.workingOrder || []);
            const selectedIndex = selectedStateKey ? workingOrder.indexOf(selectedStateKey) : -1;
            const isSingleSelection = Boolean(selectedStateKey && selectedIndex > -1);
            const canMoveLeft = isSingleSelection && selectedIndex > 0;
            const canMoveRight = isSingleSelection && selectedIndex < workingOrder.length - 1;
            const hasChanges = Boolean(isActive && sm.configReorderState?.hasChanges);
            reorderContainer.style.display = isConfigsTab ? 'inline-flex' : 'none';
            sortContainer.style.display = isConfigsTab ? 'none' : 'inline-flex';
            reorderContainer.classList.toggle('active', isActive);
            reorderToggleButton.classList.toggle('active', isActive);
            reorderToggleButton.innerText = isActive ? 'Reordering...' : 'Reorder';
            reorderToggleButton.title = isActive ? 'Reorder mode is active' : 'Edit config order';
            sortSelect.disabled = isConfigsTab && isActive;
            sortSelect.title = sortSelect.disabled ? 'Sorting is disabled while reordering configs' : 'Sort entries';
            for (const button of [reorderMoveLeftButton, reorderMoveRightButton, reorderSaveButton, reorderCancelButton]) {
                button.classList.toggle('sd-webui-sm-hidden', !isActive);
            }
            reorderMoveLeftButton.disabled = !canMoveLeft;
            reorderMoveRightButton.disabled = !canMoveRight;
            reorderSaveButton.disabled = !hasChanges;
            reorderCancelButton.disabled = !isActive;
        };
        reorderToggleButton.addEventListener('click', () => sm.enterConfigReorderMode?.());
        reorderMoveLeftButton.addEventListener('click', () => sm.moveSelectedConfigOrder?.(-1));
        reorderMoveRightButton.addEventListener('click', () => sm.moveSelectedConfigOrder?.(1));
        reorderSaveButton.addEventListener('click', () => sm.saveConfigReorderChanges?.());
        reorderCancelButton.addEventListener('click', () => sm.cancelConfigReorderChanges?.());
        sm.syncConfigReorderControlsState?.();
        entryHeader.appendChild(searchRow);
        entryHeader.appendChild(filterRow);
        // Entries
        const entries = sm.createElementWithClassList('div', 'sd-webui-sm-entries');
        entryContainer.appendChild(entryHeader);
        entryContainer.appendChild(entries);
        entryContainer.appendChild(entryFooter);
        settingsPanel = sm.createElementWithClassList('div', 'sd-webui-sm-settings-panel');
        const settingsTitle = sm.createElementWithInnerTextAndClassList('h2', 'Settings', 'sd-webui-sm-settings-title');
        settingsPanel.appendChild(settingsTitle);
        const settingsList = sm.createElementWithClassList('div', 'sd-webui-sm-settings-list');
        settingsPanel.appendChild(settingsList);
        const createSettingsRow = (labelText, descriptionText, controlElement, warningText) => {
            const row = sm.createElementWithClassList('div', 'sd-webui-sm-settings-row');
            const labelContainer = sm.createElementWithClassList('div', 'sd-webui-sm-settings-label-container');
            const label = sm.createElementWithInnerTextAndClassList('label', labelText, 'sd-webui-sm-settings-label');
            const description = sm.createElementWithInnerTextAndClassList('div', descriptionText, 'sd-webui-sm-settings-description');
            if (warningText && descriptionText.indexOf(warningText) > -1) {
                const [beforeWarning, afterWarning] = descriptionText.split(warningText);
                description.innerText = '';
                if (beforeWarning.length > 0) {
                    description.appendChild(document.createTextNode(beforeWarning));
                }
                description.appendChild(sm.createElementWithInnerTextAndClassList('span', warningText, 'sd-webui-sm-settings-warning-text'));
                if (afterWarning.length > 0) {
                    description.appendChild(document.createTextNode(afterWarning));
                }
            }
            labelContainer.appendChild(label);
            labelContainer.appendChild(description);
            row.appendChild(labelContainer);
            row.appendChild(controlElement);
            return row;
        };
        const settingsAutosave = sm.createElementWithClassList('input', sm.svelteClasses.checkbox);
        settingsAutosave.id = 'sd-webui-sm-autosave';
        settingsAutosave.type = 'checkbox';
        settingsAutosave.checked = sm.autoSaveHistory;
        settingsAutosave.addEventListener('change', () => {
            sm.autoSaveHistory = settingsAutosave.checked;
            sm.ldb.set('sd-webui-state-manager-autosave', sm.autoSaveHistory);
        });
        settingsList.appendChild(createSettingsRow('Auto-save History', 'Automatically save each generation to History.', settingsAutosave));
        const settingsStartupConfig = document.createElement('select');
        settingsStartupConfig.id = 'sd-webui-sm-settings-startup-config';
        settingsStartupConfig.classList.add('sd-webui-sm-sort');
        settingsStartupConfig.addEventListener('change', () => {
            sm.uiSettings.startupConfigStateKey = `${settingsStartupConfig.value ?? ''}`;
            sm.saveUISettings();
            sm.syncStartupConfigSettingsControls?.();
        });
        settingsList.appendChild(createSettingsRow('Startup Config', 'Config to apply automatically on startup. Select None to disable.', settingsStartupConfig));
        const smallViewEntriesControlGroup = sm.createElementWithClassList('div', 'sd-webui-sm-settings-small-view-entries-group');
        const historyEntriesLabel = sm.createElementWithInnerTextAndClassList('label', 'History', 'sd-webui-sm-settings-small-view-entries-label');
        const configEntriesLabel = sm.createElementWithInnerTextAndClassList('label', 'Configs', 'sd-webui-sm-settings-small-view-entries-label');
        const settingsHistorySmallViewEntries = document.createElement('input');
        const settingsFavouritesSmallViewEntries = document.createElement('input');
        settingsHistorySmallViewEntries.id = 'sd-webui-sm-settings-small-view-entries-history';
        settingsFavouritesSmallViewEntries.id = 'sd-webui-sm-settings-small-view-entries-favourites';
        for (const input of [settingsHistorySmallViewEntries, settingsFavouritesSmallViewEntries]) {
            input.type = 'number';
            input.min = '1';
            input.max = '500';
            input.step = '1';
            input.classList.add('sd-webui-sm-settings-small-view-entries-input');
        }
        historyEntriesLabel.htmlFor = settingsHistorySmallViewEntries.id;
        configEntriesLabel.htmlFor = settingsFavouritesSmallViewEntries.id;
        const applySmallViewEntriesChange = (group, input) => {
            const value = Math.max(1, Number.parseInt(input.value) || entriesPerPage);
            input.value = `${value}`;
            if (group == 'favourites') {
                sm.uiSettings.favouritesSmallViewEntriesPerPage = value;
            }
            else {
                sm.uiSettings.historySmallViewEntriesPerPage = value;
            }
            sm.saveUISettings();
            if (sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination && sm.entryFilter.group == group) {
                sm.currentPage = 0;
                sm.pageNumberInput.value = 1;
            }
            sm.queueEntriesUpdate(0);
        };
        settingsHistorySmallViewEntries.addEventListener('change', () => applySmallViewEntriesChange('history', settingsHistorySmallViewEntries));
        settingsFavouritesSmallViewEntries.addEventListener('change', () => applySmallViewEntriesChange('favourites', settingsFavouritesSmallViewEntries));
        smallViewEntriesControlGroup.appendChild(historyEntriesLabel);
        smallViewEntriesControlGroup.appendChild(settingsHistorySmallViewEntries);
        smallViewEntriesControlGroup.appendChild(configEntriesLabel);
        smallViewEntriesControlGroup.appendChild(settingsFavouritesSmallViewEntries);
        settingsList.appendChild(createSettingsRow('Small View Entries', 'Number of entries shown in small view for each tab.', smallViewEntriesControlGroup));
        const settingsShowSmallViewPagination = document.createElement('input');
        settingsShowSmallViewPagination.id = 'sd-webui-sm-settings-show-small-view-pagination';
        settingsShowSmallViewPagination.type = 'checkbox';
        settingsShowSmallViewPagination.classList.add(sm.svelteClasses.checkbox);
        settingsShowSmallViewPagination.addEventListener('change', () => {
            sm.uiSettings.showSmallViewPagination = settingsShowSmallViewPagination.checked;
            sm.saveUISettings();
            if (sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination) {
                sm.currentPage = 0;
                sm.pageNumberInput.value = 1;
            }
            sm.syncPaginationInteractionState();
            sm.queueEntriesUpdate(0);
        });
        settingsList.appendChild(createSettingsRow('Show Small View Pagination', 'Display page controls in small view.', settingsShowSmallViewPagination));
        const settingsShowEntryFooter = document.createElement('input');
        settingsShowEntryFooter.id = 'sd-webui-sm-settings-show-entry-footer';
        settingsShowEntryFooter.type = 'checkbox';
        settingsShowEntryFooter.classList.add(sm.svelteClasses.checkbox);
        settingsShowEntryFooter.addEventListener('change', () => {
            sm.uiSettings.showEntryFooter = settingsShowEntryFooter.checked;
            sm.saveUISettings();
            sm.syncEntryFooterVisibility?.();
        });
        settingsList.appendChild(createSettingsRow('Display Creation Time in Entries', 'Show date/time footer on entry cards.', settingsShowEntryFooter));
        const settingsDateFormat = document.createElement('select');
        settingsDateFormat.id = 'sd-webui-sm-settings-date-format';
        settingsDateFormat.classList.add('sd-webui-sm-sort');
        settingsDateFormat.innerHTML = `
            <option value="ddmmyyyy">DD/MM/YYYY</option>
            <option value="mmddyyyy">MM/DD/YYYY</option>
        `;
        settingsDateFormat.addEventListener('change', () => {
            sm.uiSettings.dateFormat = sm.getNormalisedDateFormatValue(settingsDateFormat.value);
            settingsDateFormat.value = sm.uiSettings.dateFormat;
            sm.saveUISettings();
            sm.queueEntriesUpdate(0);
        });
        settingsList.appendChild(createSettingsRow('Date Format', 'Date format used in entry card timestamps.', settingsDateFormat));
        const settingsDefaultSort = document.createElement('select');
        settingsDefaultSort.id = 'sd-webui-sm-settings-default-sort';
        settingsDefaultSort.classList.add('sd-webui-sm-sort');
        settingsDefaultSort.innerHTML = `
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
        `;
        settingsDefaultSort.addEventListener('change', () => {
            sm.uiSettings.defaultSort = sm.getNormalisedSortValue(settingsDefaultSort.value);
            settingsDefaultSort.value = sm.uiSettings.defaultSort;
            sm.saveUISettings();
            if (!sm.uiSettings.rememberFilters) {
                sm.entryFilter.sort = sm.uiSettings.defaultSort;
                sm.syncEntryFilterControls();
                sm.queueEntriesUpdate(updateEntriesDebounceMs);
            }
        });
        settingsList.appendChild(createSettingsRow('Default Sort', 'Sort mode used when filters are not remembered.', settingsDefaultSort));
        const settingsHideSearchByDefault = document.createElement('input');
        settingsHideSearchByDefault.id = 'sd-webui-sm-settings-hide-search';
        settingsHideSearchByDefault.type = 'checkbox';
        settingsHideSearchByDefault.classList.add(sm.svelteClasses.checkbox);
        settingsHideSearchByDefault.addEventListener('change', () => {
            sm.uiSettings.hideSearchByDefault = settingsHideSearchByDefault.checked;
            sm.saveUISettings();
            sm.syncSearchRowVisibility();
        });
        settingsList.appendChild(createSettingsRow('Hide Search Bar By Default', 'Hide the filter/search row in History and Configs views.', settingsHideSearchByDefault));
        const settingsRememberFilters = document.createElement('input');
        settingsRememberFilters.id = 'sd-webui-sm-settings-remember-filters';
        settingsRememberFilters.type = 'checkbox';
        settingsRememberFilters.classList.add(sm.svelteClasses.checkbox);
        settingsRememberFilters.addEventListener('change', () => {
            sm.uiSettings.rememberFilters = settingsRememberFilters.checked;
            sm.saveUISettings();
            if (sm.uiSettings.rememberFilters) {
                sm.persistEntryFilterIfEnabled();
            }
            else {
                sm.ldb.delete(entryFilterStorageKey);
            }
        });
        settingsList.appendChild(createSettingsRow('Remember Last-Used Filters', 'Persist tab/filter/search selections between sessions.', settingsRememberFilters));
        const settingsPreventApplyWithUnsavedEdits = document.createElement('input');
        settingsPreventApplyWithUnsavedEdits.id = 'sd-webui-sm-settings-prevent-apply-unsaved-edits';
        settingsPreventApplyWithUnsavedEdits.type = 'checkbox';
        settingsPreventApplyWithUnsavedEdits.classList.add(sm.svelteClasses.checkbox);
        settingsPreventApplyWithUnsavedEdits.addEventListener('change', () => {
            sm.uiSettings.preventApplyWithUnsavedConfigEdits = settingsPreventApplyWithUnsavedEdits.checked;
            sm.saveUISettings();
        });
        settingsList.appendChild(createSettingsRow('Prevent Apply With Unsaved Config Edits', 'Block apply actions until config edits are saved or discarded. Disabling this is not recommended.', settingsPreventApplyWithUnsavedEdits, 'Disabling this is not recommended.'));
        const settingsDefaultShowFavourites = document.createElement('input');
        settingsDefaultShowFavourites.id = 'sd-webui-sm-settings-default-show-favourites';
        settingsDefaultShowFavourites.type = 'checkbox';
        settingsDefaultShowFavourites.classList.add(sm.svelteClasses.checkbox);
        settingsDefaultShowFavourites.addEventListener('change', () => {
            sm.uiSettings.defaultShowFavouritesInHistory = settingsDefaultShowFavourites.checked;
            sm.saveUISettings();
            if (!sm.uiSettings.rememberFilters) {
                sm.entryFilter.showFavouritesInHistory = sm.uiSettings.defaultShowFavouritesInHistory;
                sm.syncEntryFilterControls();
                sm.queueEntriesUpdate(updateEntriesDebounceMs);
            }
        });
        settingsList.appendChild(createSettingsRow('Show Saved Configs In History By Default', 'Controls whether configs are shown in History by default.', settingsDefaultShowFavourites));
        const settingsShowConfigNames = document.createElement('input');
        settingsShowConfigNames.id = 'sd-webui-sm-settings-show-config-names';
        settingsShowConfigNames.type = 'checkbox';
        settingsShowConfigNames.classList.add(sm.svelteClasses.checkbox);
        settingsShowConfigNames.addEventListener('change', () => {
            sm.uiSettings.showConfigNamesOnCards = settingsShowConfigNames.checked;
            sm.saveUISettings();
            sm.syncConfigCardNameVisibility?.();
        });
        settingsList.appendChild(createSettingsRow('Show Config Names on Cards', 'Display config names on saved-config cards in Configs and History.', settingsShowConfigNames));
        const settingsShowConfigTypeBadge = document.createElement('input');
        settingsShowConfigTypeBadge.id = 'sd-webui-sm-settings-show-config-type-badge';
        settingsShowConfigTypeBadge.type = 'checkbox';
        settingsShowConfigTypeBadge.classList.add(sm.svelteClasses.checkbox);
        settingsShowConfigTypeBadge.addEventListener('change', () => {
            sm.uiSettings.alwaysShowConfigTypeBadge = settingsShowConfigTypeBadge.checked;
            sm.saveUISettings();
            sm.syncConfigTypeBadgeVisibility?.();
        });
        settingsList.appendChild(createSettingsRow('Always Show Config Type Badge', 'Always show txt2img/img2img type on config cards.', settingsShowConfigTypeBadge));
        const settingsShowConfigsFirst = document.createElement('input');
        settingsShowConfigsFirst.id = 'sd-webui-sm-settings-show-configs-first';
        settingsShowConfigsFirst.type = 'checkbox';
        settingsShowConfigsFirst.classList.add(sm.svelteClasses.checkbox);
        settingsShowConfigsFirst.addEventListener('change', () => {
            sm.uiSettings.showConfigsFirst = settingsShowConfigsFirst.checked;
            sm.saveUISettings();
            sm.syncNavTabOrder?.();
            sm.syncPanelTabButtons?.();
        });
        settingsList.appendChild(createSettingsRow('Show Configs First', 'Display the Configs tab before History.', settingsShowConfigsFirst));
        const settingsDefaultOpenTab = document.createElement('select');
        settingsDefaultOpenTab.id = 'sd-webui-sm-settings-default-open-tab';
        settingsDefaultOpenTab.classList.add('sd-webui-sm-sort');
        settingsDefaultOpenTab.innerHTML = `
            <option value="history">History</option>
            <option value="favourites">Configs</option>
            <option value="settings">Settings</option>
        `;
        settingsDefaultOpenTab.addEventListener('change', () => {
            sm.uiSettings.defaultOpenTab = sm.getNormalisedPanelTabValue(settingsDefaultOpenTab.value);
            settingsDefaultOpenTab.value = sm.uiSettings.defaultOpenTab;
            sm.saveUISettings();
        });
        settingsList.appendChild(createSettingsRow('Default Open Tab', 'Tab to open when showing the panel.', settingsDefaultOpenTab));
        sm.syncPanelTabButtons = function () {
            for (const tabName in panelTabButtons) {
                panelTabButtons[tabName].classList.toggle('selected', sm.activePanelTab == tabName);
            }
        };
        sm.syncPanelTabVisibility = function () {
            const showSettings = sm.activePanelTab == 'settings';
            sm.inspector.style.display = showSettings ? 'none' : '';
            settingsPanel.style.display = showSettings ? 'block' : 'none';
            sm.syncSmallViewAccordionState?.();
            updateShowSavedConfigsToggleVisibility();
            sm.syncConfigCardNameVisibility?.();
            sm.syncConfigTypeBadgeVisibility?.();
            sm.syncConfigReorderControlsState?.();
        };
        sm.syncNavTabOrder();
        sm.syncPanelTabButtons();
        const createEntrySlot = () => {
            const entry = sm.createElementWithClassList('button', 'sd-webui-sm-entry');
            entry.style.display = 'none';
            entry.appendChild(sm.createElementWithClassList('div', 'type'));
            entry.appendChild(sm.createElementWithClassList('div', 'config-name'));
            const gearButton = sm.createElementWithClassList('div', 'sd-webui-sm-entry-gear');
            gearButton.innerText = '⚙';
            gearButton.title = 'Config actions';
            gearButton.tabIndex = 0;
            gearButton.setAttribute('role', 'button');
            entry.appendChild(gearButton);
            const restoreButton = sm.createElementWithClassList('div', 'sd-webui-sm-entry-restore');
            restoreButton.innerText = 'Restore';
            restoreButton.title = 'Restore this version';
            restoreButton.tabIndex = 0;
            restoreButton.setAttribute('role', 'button');
            restoreButton.style.display = 'none';
            entry.appendChild(restoreButton);
            const footer = sm.createElementWithClassList('div', 'footer');
            footer.appendChild(sm.createElementWithClassList('div', 'date'));
            footer.appendChild(sm.createElementWithClassList('div', 'time'));
            entry.appendChild(footer);
            return entry;
        };
        sm.ensureEntrySlotCount = function (minCount) {
            while (entries.childNodes.length < minCount) {
                entries.appendChild(createEntrySlot());
            }
        };
        sm.ensureEntrySlotCount(initialEntrySlotCount);
        const previewFileInput = document.createElement('input');
        previewFileInput.type = 'file';
        previewFileInput.accept = 'image/*';
        previewFileInput.style.display = 'none';
        entryContainer.appendChild(previewFileInput);
        const entryGearMenu = sm.createElementWithClassList('div', 'sd-webui-sm-entry-gear-menu');
        const changePreviewAction = sm.createElementWithInnerTextAndClassList('button', 'Change Preview...', 'sd-webui-sm-entry-gear-menu-action');
        entryGearMenu.appendChild(changePreviewAction);
        entryContainer.appendChild(entryGearMenu);
        let activeGearMenuEntry = null;
        let pendingPreviewStateKey = '';
        const closeEntryGearMenu = () => {
            activeGearMenuEntry = null;
            entryGearMenu.style.display = 'none';
            entryGearMenu.dataset['open'] = 'false';
        };
        const openEntryGearMenu = (entry, triggerElement) => {
            activeGearMenuEntry = entry;
            entryGearMenu.dataset['open'] = 'true';
            entryGearMenu.style.display = 'block';
            entryGearMenu.style.left = '0px';
            entryGearMenu.style.top = '0px';
            entryGearMenu.style.visibility = 'hidden';
            const menuPadding = 8;
            const triggerBounds = triggerElement.getBoundingClientRect();
            const menuBounds = entryGearMenu.getBoundingClientRect();
            const maxLeft = window.innerWidth - menuBounds.width - menuPadding;
            const maxTop = window.innerHeight - menuBounds.height - menuPadding;
            const left = Math.min(Math.max(triggerBounds.right - menuBounds.width, menuPadding), Math.max(menuPadding, maxLeft));
            const top = Math.min(Math.max(triggerBounds.bottom + 4, menuPadding), Math.max(menuPadding, maxTop));
            entryGearMenu.style.left = `${left}px`;
            entryGearMenu.style.top = `${top}px`;
            entryGearMenu.style.visibility = 'visible';
        };
        sm.closeEntryGearMenu = closeEntryGearMenu;
        changePreviewAction.addEventListener('click', () => {
            if (!activeGearMenuEntry || !activeGearMenuEntry.data) {
                closeEntryGearMenu();
                return;
            }
            const stateKey = `${activeGearMenuEntry.data.createdAt ?? ''}`;
            const targetState = sm.memoryStorage.entries.data[stateKey];
            if (!targetState) {
                closeEntryGearMenu();
                return;
            }
            pendingPreviewStateKey = stateKey;
            closeEntryGearMenu();
            previewFileInput.value = '';
            previewFileInput.click();
        });
        previewFileInput.addEventListener('change', async () => {
            const selectedFile = previewFileInput.files?.[0];
            const targetState = sm.memoryStorage.entries.data[pendingPreviewStateKey];
            pendingPreviewStateKey = '';
            if (!selectedFile || !targetState) {
                return;
            }
            const previewData = await sm.createPreviewImageDataFromFile(selectedFile);
            if (!previewData) {
                alert('Failed to read preview image.');
                return;
            }
            targetState.preview = previewData;
            sm.updateStorage();
            sm.queueEntriesUpdate(0);
        });
        const getEntryFromEvent = (event) => {
            if (!(event.target instanceof Element)) {
                return null;
            }
            const entry = event.target.closest('.sd-webui-sm-entry');
            if (!entry || !entry.data || entry.style.display == 'none') {
                return null;
            }
            return entry;
        };
        entries.addEventListener('click', (event) => {
            if (!(event.target instanceof Element)) {
                return;
            }
            const restoreButton = event.target.closest('.sd-webui-sm-entry-restore');
            if (restoreButton) {
                event.preventDefault();
                event.stopPropagation();
                closeEntryGearMenu();
                const entry = restoreButton.closest('.sd-webui-sm-entry');
                if (!entry || !entry.data || entry.style.display == 'none') {
                    return;
                }
                sm.selection.select(entry, 'single');
                if (!sm.canProceedWithApplyAction()) {
                    return;
                }
                sm.applyAll(entry.data);
                return;
            }
            const gearButton = event.target.closest('.sd-webui-sm-entry-gear');
            if (gearButton) {
                event.preventDefault();
                event.stopPropagation();
                const entry = gearButton.closest('.sd-webui-sm-entry');
                if (!entry || !entry.data || entry.style.display == 'none') {
                    closeEntryGearMenu();
                    return;
                }
                if (entryGearMenu.dataset['open'] == 'true' && activeGearMenuEntry == entry) {
                    closeEntryGearMenu();
                }
                else {
                    openEntryGearMenu(entry, gearButton);
                }
                return;
            }
            closeEntryGearMenu();
            const entry = getEntryFromEvent(event);
            if (!entry) {
                return;
            }
            const currentSelectedEntry = sm.selection.entries.length == 1 ? sm.selection.entries[0] : null;
            if (currentSelectedEntry && currentSelectedEntry != entry) {
                if (!sm.confirmDiscardPendingProfileChanges()) {
                    return;
                }
            }
            if (event.shiftKey) {
                sm.selection.select(entry, 'range');
            }
            else if (event.ctrlKey || event.metaKey) {
                sm.selection.select(entry, 'add');
            }
            else {
                sm.selection.select(entry, 'single');
            }
            if (sm.activePanelTab == 'favourites') {
                sm.syncHistoryVersionContextFromSelection?.();
            }
        });
        entries.addEventListener('dblclick', (event) => {
            const entry = getEntryFromEvent(event);
            if (!entry) {
                return;
            }
            if (!sm.canProceedWithApplyAction()) {
                return;
            }
            sm.applyAll(entry.data);
        });
        entries.addEventListener('keydown', (event) => {
            if (event.key != 'Enter' && event.key != ' ') {
                return;
            }
            if (!(event.target instanceof Element)) {
                return;
            }
            const gearButton = event.target.closest('.sd-webui-sm-entry-gear');
            if (!gearButton) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            gearButton.click();
        });
        document.addEventListener('mousedown', (event) => {
            if (entryGearMenu.dataset['open'] != 'true') {
                return;
            }
            if (!(event.target instanceof Element)) {
                return;
            }
            if (event.target.closest('.sd-webui-sm-entry-gear') || event.target.closest('.sd-webui-sm-entry-gear-menu')) {
                return;
            }
            closeEntryGearMenu();
        });
        // Add to DOM
        panel.appendChild(nav);
        panel.appendChild(entryContainer);
        panel.appendChild(sm.inspector);
        panel.appendChild(settingsPanel);
        sm.panelContainer.appendChild(panel);
        sm.mountPanelContainer();
        sm.panelContainer.classList.add('open');
        sm.syncModalOverlayState();
        // Event listeners
        // app.querySelector('#txt2img_generate').addEventListener('click', () => sm.lastUsedState = sm.getCurrentState('txt2img'));
        // app.querySelector('#img2img_generate').addEventListener('click', () => sm.lastUsedState = sm.getCurrentState('img2img'));
        // Use above listeners for a less invasive button listener. But if we wanna catch ctrl+enter generation as well...
        const originalSubmit = submit;
        submit = async function () {
            sm.lastUsedState = await sm.getCurrentState('txt2img');
            return originalSubmit(...arguments);
        };
        const originaSubmitImg2img = submit_img2img;
        submit_img2img = async function () {
            sm.lastUsedState = await sm.getCurrentState('img2img');
            return originaSubmitImg2img(...arguments);
        };
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                sm.closeEntryGearMenu?.();
            }
            if (event.key !== 'Escape' || !sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) {
                return;
            }
            sm.panelContainer.classList.remove('sd-webui-sm-modal-panel');
            sm.mountPanelContainer();
            sm.syncModalOverlayState();
            sm.updateInspector();
            event.preventDefault();
        });
        const handleSmallViewModeChange = () => {
            sm.syncPaginationInteractionState();
            if (sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination && sm.currentPage !== 0) {
                sm.currentPage = 0;
                sm.pageNumberInput.value = 1;
            }
            sm.updateEntries();
        };
        window.addEventListener('resize', handleSmallViewModeChange);
        sm.applyLoadedPreferences();
        app.addEventListener('input', sm.updateAllValueDiffDatas);
        app.addEventListener('change', sm.updateAllValueDiffDatas);
    };
    sm.updateAllValueDiffDatas = function () {
        for (const element of app.querySelectorAll('[data-value-diff]')) {
            element.update?.();
        }
    };
    sm.createPillToggle = function (label, htmlProperties, checkboxId, isOn, onchange, immediatelyCallOnChange) {
        const container = sm.createElementWithClassList('div', 'sd-webui-sm-pill-toggle');
        for (const propName in htmlProperties) {
            container[propName] = htmlProperties[propName];
        }
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isOn;
        checkbox.id = checkboxId;
        const labelElement = document.createElement('label');
        labelElement.htmlFor = checkbox.id;
        labelElement.innerText = label;
        container.appendChild(checkbox);
        container.appendChild(labelElement);
        checkbox.addEventListener('change', () => onchange(checkbox.checked));
        if (immediatelyCallOnChange) {
            onchange(checkbox.checked);
        }
        return container;
    };
    sm.toggle = function () {
        if (!sm.utils.getCurrentGenerationTypeFromUI()) {
            return;
        }
        sm.mountPanelContainer();
        const panelContainer = app.querySelector('.sd-webui-sm-panel-container');
        panelContainer.classList.toggle('open');
        if (panelContainer.classList.contains('open')) {
            sm.applyDefaultOpenTab();
            sm.queueEntriesUpdate(0);
        }
        sm.syncModalOverlayState();
    };
    sm.mountPanelContainer = function () {
        if (!sm.panelContainer) {
            return;
        }
        const clearHostContainClass = () => {
            for (const hostContain of Array.from(app.querySelectorAll('.contain.sd-webui-sm-host-contain'))) {
                hostContain.classList.remove('sd-webui-sm-host-contain');
            }
        };
        const markHostContainClass = (element) => {
            if (!(element instanceof Element)) {
                return;
            }
            const hostContain = element.closest('.contain');
            if (!hostContain) {
                return;
            }
            clearHostContainClass();
            hostContain.classList.add('sd-webui-sm-host-contain');
        };
        const generationType = sm.utils.getCurrentGenerationTypeFromUI();
        const isGenerationTab = generationType == 'txt2img' || generationType == 'img2img';
        if (!isGenerationTab) {
            clearHostContainClass();
            sm.panelContainer.style.display = 'none';
            if (sm.panelContainer.classList.contains('sd-webui-sm-modal-panel')) {
                sm.panelContainer.classList.remove('sd-webui-sm-modal-panel');
                sm.syncModalOverlayState();
            }
            return;
        }
        sm.panelContainer.style.removeProperty('display');
        const isModal = sm.panelContainer.classList.contains('sd-webui-sm-modal-panel');
        const isSmallViewMode = sm.isSmallViewMode();
        const shouldResetPage = isSmallViewMode && !sm.uiSettings.showSmallViewPagination && sm.currentPage !== 0;
        sm.syncPaginationInteractionState();
        if (shouldResetPage && sm.pageNumberInput) {
            sm.currentPage = 0;
            sm.pageNumberInput.value = 1;
            sm.queueEntriesUpdate(0);
        }
        sm.syncSmallViewAccordionState?.();
        sm.syncModalQuickControlsState?.();
        sm.syncQuickConfigApplyButtonState?.();
        const contain = app.querySelector('.contain');
        if (isModal) {
            clearHostContainClass();
            if (contain && sm.panelContainer.parentNode != contain) {
                contain.appendChild(sm.panelContainer);
            }
            return;
        }
        const resultsPanel = app.querySelector(`#${generationType}_results_panel`);
        if (resultsPanel) {
            if (resultsPanel.nextElementSibling != sm.panelContainer) {
                resultsPanel.insertAdjacentElement('afterend', sm.panelContainer);
            }
            markHostContainClass(sm.panelContainer);
            return;
        }
        const fallbackContainer = app.querySelector('.contain');
        if (fallbackContainer && sm.panelContainer.parentNode != fallbackContainer) {
            fallbackContainer.appendChild(sm.panelContainer);
        }
        markHostContainClass(sm.panelContainer);
    };
    sm.getMode = function () {
        return sm.panelContainer.classList.contains('sd-webui-sm-modal-panel') ? 'modal' : 'docked';
    };
    sm.isSmallViewMode = function () {
        const entries = sm.panelContainer?.querySelector('.sd-webui-sm-entries');
        if (!entries) {
            return false;
        }
        return window.getComputedStyle(entries).display != 'grid';
    };
    sm.syncEntryViewModeState = function () {
        const entryContainer = sm.panelContainer?.querySelector('.sd-webui-sm-entry-container');
        if (!entryContainer) {
            return;
        }
        entryContainer.classList.toggle('sd-webui-sm-entry-container-small-view', sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination);
    };
    sm.syncPaginationInteractionState = function () {
        if (!sm.pageButtonNavigation || !sm.pageNumberInput) {
            return;
        }
        const disablePagination = sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination;
        sm.syncEntryViewModeState();
        sm.pageButtonNavigation.classList.toggle('disabled', disablePagination);
        for (const button of sm.pageButtonNavigation.querySelectorAll('button')) {
            button.disabled = disablePagination;
        }
        sm.pageNumberInput.disabled = disablePagination;
    };
    sm.goToPage = function (page) {
        if (sm.isSmallViewMode() && !sm.uiSettings.showSmallViewPagination) {
            sm.currentPage = 0;
            sm.pageNumberInput.value = 1;
            return;
        }
        if (!sm.confirmDiscardPendingProfileChanges()) {
            sm.pageNumberInput.value = sm.currentPage + 1;
            return;
        }
        sm.currentPage = page;
        sm.pageNumberInput.value = page + 1;
        sm.updateEntries();
    };
    sm.updateEntries = function () {
        if (!sm.hasOwnProperty('memoryStorage')) { // Storage not init'd yet, defer until it's ready
            sm.updateEntriesWhenStorageReady = true;
            return;
        }
        sm.syncStartupConfigSettingsControls?.();
        sm.closeEntryGearMenu?.();
        // Clear old listeners
        entryEventListenerAbortController.abort();
        entryEventListenerAbortController = new AbortController();
        sm.syncPaginationInteractionState();
        const currentEntriesPerPage = sm.getEntriesPerPage();
        const entries = sm.panelContainer.querySelector('.sd-webui-sm-entries');
        const isHistoryVersionMode = sm.isHistoryVersionPreviewMode();
        sm.inspectorPreviewOnly = isHistoryVersionMode;
        if (entries) {
            if (isHistoryVersionMode) {
                entries.style.display = 'flex';
                entries.style.flexDirection = 'column';
                entries.style.alignItems = 'stretch';
                entries.style.gap = '8px';
            }
            else {
                entries.style.removeProperty('display');
                entries.style.removeProperty('flex-direction');
                entries.style.removeProperty('align-items');
                entries.style.removeProperty('gap');
            }
        }
        sm.ensureEntrySlotCount(currentEntriesPerPage);
        const historyVersionContextId = `${sm.historyVersionContext?.configVersionId ?? ''}`.trim();
        const filteredEntries = Object.entries(sm.memoryStorage.entries.data).filter(kv => {
            const [stateKey, stateData] = kv;
            if (isHistoryVersionMode) {
                if (sm.entryFilter.types.indexOf(stateData.type) == -1) {
                    return false;
                }
                const stateVersionId = sm.getConfigVersionBaseId(stateData, `${stateKey ?? ''}`);
                return stateVersionId == historyVersionContextId;
            }
            return sm.entryFilter.matches(stateData);
        });
        const sortBy = sm.entryFilter.sort;
        const useManualConfigSort = sm.entryFilter.group == 'favourites';
        const manualOrder = useManualConfigSort ? sm.getActiveFavouritesOrder?.() : [];
        const manualOrderIndexes = new Map((manualOrder || []).map((stateKey, index) => [stateKey, index]));
        filteredEntries.sort((a, b) => {
            const aState = a[1];
            const bState = b[1];
            const aKey = `${a[0] ?? ''}`;
            const bKey = `${b[0] ?? ''}`;
            if (isHistoryVersionMode) {
                const aVersionNumber = sm.getConfigVersionNumber(aState);
                const bVersionNumber = sm.getConfigVersionNumber(bState);
                if (aVersionNumber != bVersionNumber) {
                    return bVersionNumber - aVersionNumber;
                }
                return (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
            }
            if (useManualConfigSort) {
                const aIndex = manualOrderIndexes.has(aKey) ? manualOrderIndexes.get(aKey) : Number.MAX_SAFE_INTEGER;
                const bIndex = manualOrderIndexes.has(bKey) ? manualOrderIndexes.get(bKey) : Number.MAX_SAFE_INTEGER;
                if (aIndex != bIndex) {
                    return aIndex - bIndex;
                }
                return (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
            }
            switch (sortBy) {
                case 'oldest':
                    return (Number(aState.createdAt ?? a[0]) || 0) - (Number(bState.createdAt ?? b[0]) || 0);
                case 'name':
                    return `${aState.name ?? ''}`.localeCompare(`${bState.name ?? ''}`) || (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
                case 'type':
                    return `${aState.type ?? ''}`.localeCompare(`${bState.type ?? ''}`) || (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
                case 'newest':
                default:
                    return (Number(bState.createdAt ?? b[0]) || 0) - (Number(aState.createdAt ?? a[0]) || 0);
            }
        });
        const filteredKeys = filteredEntries.map(([key]) => key);
        const numPages = Math.max(Math.ceil(filteredKeys.length / currentEntriesPerPage), 1);
        sm.pageNumberInput.max = numPages;
        sm.maxPageNumberLabel.innerText = `of ${numPages}`;
        if (sm.currentPage >= numPages) {
            sm.currentPage = numPages - 1;
            sm.pageNumberInput.value = numPages;
        }
        const endPagesCorrection = Math.max(3 - (numPages - sm.currentPage), 0);
        const pageButtonStart = Math.max(sm.currentPage - 2 - endPagesCorrection, 0); // 0-indexed, not by label
        for (let i = 0; i < 5; i++) {
            const pageButton = sm.pageButtonNavigation.childNodes[2 + i];
            const pageNumber = pageButtonStart + i;
            if (pageNumber < numPages) {
                pageButton.innerText = pageNumber + 1;
                pageButton.style.display = 'inline-block';
                pageButton.classList.toggle('active', pageNumber == sm.currentPage);
                pageButton.addEventListener('click', () => {
                    sm.goToPage(pageNumber);
                }, { signal: entryEventListenerAbortController.signal });
            }
            else {
                pageButton.style.display = 'none';
            }
        }
        // >
        sm.pageButtonNavigation.childNodes[7].addEventListener('click', () => {
            sm.goToPage(Math.min(sm.currentPage + 1, numPages));
        }, { signal: entryEventListenerAbortController.signal });
        // >>
        sm.pageButtonNavigation.childNodes[8].addEventListener('click', () => {
            sm.goToPage(numPages);
        }, { signal: entryEventListenerAbortController.signal });
        const dataPageOffset = sm.currentPage * currentEntriesPerPage;
        const numEntries = Math.min(currentEntriesPerPage, filteredKeys.length - dataPageOffset);
        for (let i = 0; i < numEntries; i++) {
            const data = sm.memoryStorage.entries.data[filteredKeys[dataPageOffset + i]];
            const entry = entries.childNodes[i];
            const entryStateKey = `${data.createdAt ?? ''}`;
            entry.data = data;
            sm.queueEntryPreview(entry, `${data.preview ?? ''}`);
            entry.style.display = isHistoryVersionMode ? 'flex' : 'inherit';
            entry.style.width = isHistoryVersionMode ? '100%' : '';
            entry.classList.toggle('active', sm.selection.selectedStateKeys.has(entryStateKey));
            const creationDate = new Date(data.createdAt);
            const configName = `${data.name ?? ''}`.trim();
            const versionNumber = sm.getConfigVersionNumber(data);
            const day = creationDate.getDate().toString().padStart(2, '0');
            const month = (creationDate.getMonth() + 1).toString().padStart(2, '0');
            const year = creationDate.getFullYear().toString().padStart(2, '0');
            const hours = creationDate.getHours().toString().padStart(2, '0');
            const minutes = creationDate.getMinutes().toString().padStart(2, '0');
            const seconds = creationDate.getSeconds().toString().padStart(2, '0');
            const fullDateText = sm.getNormalisedDateFormatValue(sm.uiSettings.dateFormat) == 'mmddyyyy'
                ? `${month}/${day}/${year}`
                : `${day}/${month}/${year}`;
            const fullTimeText = `${hours}:${minutes}:${seconds}`;
            const fullTimestamp = `${fullDateText} ${fullTimeText}`;
            const dateElement = entry.querySelector('.date');
            const timeElement = entry.querySelector('.time');
            const versionChangeSummary = `${data.configVersionChangeSummary ?? ''}`.trim();
            const displayConfigName = isHistoryVersionMode
                ? [`v${versionNumber}`, fullTimestamp, versionChangeSummary].filter(part => part.length > 0).join(' — ')
                : configName;
            entry.querySelector('.type').innerText = `${data.type == 'txt2img' ? '🖋' : '🖼️'} ${data.type}`;
            entry.querySelector('.config-name').innerText = displayConfigName;
            entry.querySelector('.config-name').title = displayConfigName;
            entry.classList.toggle('has-config-name', displayConfigName.length > 0);
            const restoreButton = entry.querySelector('.sd-webui-sm-entry-restore');
            if (restoreButton) {
                restoreButton.style.display = isHistoryVersionMode ? '' : 'none';
            }
            dateElement.innerText = fullDateText;
            timeElement.innerText = `${hours}:${minutes}`;
            dateElement.title = fullTimestamp;
            timeElement.title = fullTimestamp;
            sm.updateEntryIndicators(entry);
        }
        for (let i = numEntries; i < entries.childNodes.length; i++) {
            const hiddenEntry = entries.childNodes[i];
            hiddenEntry.classList.remove('active');
            hiddenEntry.style.display = 'none';
            sm.clearEntryPreview(hiddenEntry);
        }
        sm.selection.entries = Array.from(entries.childNodes).filter((entry) => entry.style.display != 'none' && entry.classList.contains('active'));
        sm.renderQuickConfigMenu?.();
        sm.syncConfigReorderControlsState?.();
    };
    sm.updateEntryIndicators = function (entry) {
        entry.classList.toggle('config', (entry.data.groups?.indexOf('favourites') ?? -1) > -1);
        entry.classList.toggle('configured', entry.data.hasOwnProperty('name') && entry.data.name != undefined && entry.data.name.length > 0);
    };
    sm.clearSelection = function (updateInspector = true) {
        if (!sm.selection) {
            return;
        }
        for (const selectedEntry of (sm.selection.entries || [])) {
            selectedEntry?.classList?.remove('active');
        }
        sm.selection.entries = [];
        sm.selection.selectedStateKeys?.clear?.();
        sm.selection.rangeSelectStart = null;
        sm.selection.undoableRangeSelectionAmount = 0;
        if (updateInspector) {
            sm.activeProfileDraft = null;
            sm.updateInspector();
            sm.syncConfigReorderControlsState?.();
        }
    };
    sm.updateInspector = async function () {
        sm.captureInspectorAccordionState?.();
        sm.inspector.innerHTML = "";
        const isHistoryVersionMode = sm.isHistoryVersionPreviewMode();
        sm.inspectorPreviewOnly = isHistoryVersionMode;
        sm.activeProfileSaveButtons = [];
        if (sm.selection.entries.length == 0) {
            sm.activeProfileDraft = null;
            return;
        }
        else if (sm.selection.entries.length > 1) {
            sm.activeProfileDraft = null;
            const multiSelectContainer = sm.createElementWithClassList('div', 'category', 'meta-container');
            const selectedEntries = [...sm.selection.entries];
            const nonConfigEntries = selectedEntries.filter((selectedEntry) => (selectedEntry.data?.groups?.indexOf('favourites') ?? -1) == -1);
            if (nonConfigEntries.length > 0) {
                const labelCount = nonConfigEntries.length;
                const configAllButton = sm.createElementWithInnerTextAndClassList('button', `Save ${labelCount} as configs`, 'sd-webui-sm-inspector-wide-button', 'sd-webui-sm-inspector-load-button');
                multiSelectContainer.appendChild(configAllButton);
                configAllButton.addEventListener('click', () => {
                    for (const selectedEntry of nonConfigEntries) {
                        const sourceState = selectedEntry.data;
                        const duplicatedState = JSON.parse(JSON.stringify(sourceState));
                        duplicatedState.groups = sm.getGroupsWithFavouriteState(sourceState.groups || [], true);
                        sm.upsertState(duplicatedState);
                    }
                    sm.clearSelection(false);
                    sm.updateEntries();
                    sm.updateInspector();
                });
            }
            const deleteAllButton = sm.createElementWithInnerTextAndClassList('button', `🗑 Delete all ${sm.selection.entries.length} selected items`, 'sd-webui-sm-inspector-wide-button', 'sd-webui-sm-inspector-load-button');
            multiSelectContainer.appendChild(deleteAllButton);
            deleteAllButton.addEventListener('click', () => {
                const deleted = sm.deleteStates(true, ...sm.selection.entries.map(e => e.data.createdAt));
                if (!deleted) {
                    return;
                }
                sm.clearSelection(false);
                sm.updateEntries();
                sm.updateInspector();
            });
            sm.inspector.appendChild(multiSelectContainer);
            return;
        }
        const entry = sm.selection.entries[0];
        const activeDraft = sm.ensureActiveProfileDraft(entry);
        const currentState = isHistoryVersionMode ? await sm.getCurrentState(entry.data.type) : null;
        if (entry !== sm.selection.entries[0]) {
            return;
        }
        const metaContainer = sm.createElementWithClassList('div', 'category', 'meta-container');
        const nameField = document.createElement('input');
        nameField.placeholder = "Give this config a name";
        nameField.type = 'text';
        nameField.value = activeDraft.name || '';
        const favButton = sm.createElementWithInnerTextAndClassList('button', '+', 'sd-webui-sm-inspector-fav-button');
        const unsaveButton = sm.createElementWithInnerTextAndClassList('button', '−', 'sd-webui-sm-inspector-unsave-button');
        const deleteButton = sm.createElementWithInnerTextAndClassList('button', '🗑', 'sd-webui-sm-inspector-delete-button');
        const saveChangesButton = sm.createElementWithInnerTextAndClassList('button', 'Save Changes', 'sd-webui-sm-inspector-save-button', 'sd-webui-sm-inspector-load-button');
        const loadAllButton = sm.createElementWithInnerTextAndClassList('button', 'Apply Config', 'sd-webui-sm-inspector-load-all-button', 'sd-webui-sm-inspector-load-button');
        const canSaveConfigChanges = activeDraft.originalIsFavourite || sm.entryFilter.group == 'favourites';
        favButton.title = "Save as config";
        unsaveButton.title = "Remove from saved configs";
        deleteButton.title = "Delete this entry (warning: this cannot be undone)";
        saveChangesButton.title = canSaveConfigChanges ? "Save edited config settings" : "Save Changes is only available for saved configs";
        loadAllButton.title = "Apply config settings to the current UI";
        if (isHistoryVersionMode) {
            loadAllButton.style.display = 'none';
        }
        const syncConfigActionButtons = () => {
            const trimmedName = `${activeDraft.name ?? ''}`.trim();
            const hasConfigName = trimmedName.length > 0;
            const originalTrimmedName = `${activeDraft.originalName ?? ''}`.trim();
            const nameChanged = trimmedName !== originalTrimmedName;
            const canSaveAsConfig = hasConfigName && (!activeDraft.originalIsFavourite || nameChanged);
            favButton.classList.toggle('on', canSaveAsConfig);
            favButton.disabled = !canSaveAsConfig;
            if (!hasConfigName) {
                favButton.title = "Enter a config name first";
            }
            else if (activeDraft.originalIsFavourite && !nameChanged) {
                favButton.title = "Change the config name to save a new copy";
            }
            else {
                favButton.title = "Save as config";
            }
            unsaveButton.disabled = !activeDraft.isFavourite;
        };
        syncConfigActionButtons();
        saveChangesButton.disabled = !canSaveConfigChanges;
        metaContainer.appendChild(nameField);
        metaContainer.appendChild(favButton);
        metaContainer.appendChild(unsaveButton);
        metaContainer.appendChild(deleteButton);
        metaContainer.appendChild(saveChangesButton);
        metaContainer.appendChild(loadAllButton);
        if (sm.getMode() == 'modal') {
            metaContainer.removeChild(saveChangesButton);
        }
        const viewSettingsContainer = sm.createElementWithClassList('div', 'category', 'view-settings-container');
        viewSettingsContainer.appendChild(sm.createPillToggle('', { title: "Color-code properties (green = unchanged, orange = missing from current UI, red = different from current UI)", id: 'sd-webui-sm-inspector-view-coloured-labels' }, 'sd-webui-sm-inspector-view-coloured-labels-checkbox', true, (isOn) => sm.inspector.dataset['useColorCode'] = isOn, true));
        viewSettingsContainer.appendChild(sm.createPillToggle('unchanged', { title: "Show unchanged properties", id: 'sd-webui-sm-inspector-view-unchanged' }, 'sd-webui-sm-inspector-view-unchanged-checkbox', true, (isOn) => sm.inspector.dataset['showUnchanged'] = isOn, true));
        viewSettingsContainer.appendChild(sm.createPillToggle('missing/obsolete', { title: "Show properties that are missing from the current UI", id: 'sd-webui-sm-inspector-view-missing' }, 'sd-webui-sm-inspector-view-missing-checkbox', true, (isOn) => sm.inspector.dataset['showMissing'] = isOn, true));
        viewSettingsContainer.appendChild(sm.createPillToggle('Try applying missing/obsolete', { title: "Try applying the values of missing properties", id: 'sd-webui-sm-inspector-apply-missing' }, 'sd-webui-sm-inspector-apply-missing-checkbox', false, (isOn) => sm.inspector.dataset['applyMissing'] = isOn, true));
        const nameInputCallback = () => {
            activeDraft.name = nameField.value;
            syncConfigActionButtons();
            sm.refreshActiveProfileDraftState();
        };
        nameField.addEventListener('input', nameInputCallback);
        favButton.addEventListener('click', () => {
            const finalName = `${activeDraft.name ?? ''}`.trim();
            const originalTrimmedName = `${activeDraft.originalName ?? ''}`.trim();
            const nameChanged = finalName !== originalTrimmedName;
            const canSaveAsConfig = finalName.length > 0 && (!activeDraft.originalIsFavourite || nameChanged);
            if (!canSaveAsConfig) {
                return;
            }
            const newState = JSON.parse(JSON.stringify(entry.data));
            if (finalName.length > 0) {
                newState.name = finalName;
            }
            else {
                delete newState.name;
            }
            newState.groups = sm.getGroupsWithFavouriteState(entry.data.groups || [], true);
            newState.inspectorState = {
                checkboxes: { ...(activeDraft.inspectorState.checkboxes || {}) }
            };
            const savedState = sm.upsertState(newState);
            sm.activeProfileDraft = null;
            sm.updateEntries();
            const entries = sm.panelContainer.querySelector('.sd-webui-sm-entries');
            const targetEntry = Array.from(entries.childNodes).find((candidate) => `${candidate?.data?.createdAt ?? ''}` == `${savedState.createdAt}`);
            if (targetEntry) {
                sm.selection.select(targetEntry, 'single');
            }
            else {
                sm.updateInspector();
            }
        });
        unsaveButton.addEventListener('click', () => {
            if (!activeDraft.isFavourite) {
                return;
            }
            deleteButton.click();
        });
        deleteButton.addEventListener('click', () => {
            const deleted = sm.deleteStates(true, entry.data.createdAt);
            if (!deleted) {
                return;
            }
            sm.clearSelection(false);
            sm.updateEntries();
            sm.updateInspector();
        });
        saveChangesButton.addEventListener('click', () => sm.saveActiveProfileChanges());
        loadAllButton.addEventListener('click', () => {
            if (sm.inspectorPreviewOnly) {
                return;
            }
            if (!sm.canProceedWithApplyAction()) {
                return;
            }
            sm.applyAll(entry.data);
        });
        if (isHistoryVersionMode && currentState) {
            const summaryContainer = sm.createElementWithClassList('div', 'category', 'sd-webui-sm-history-preview-summary');
            const summaryHeader = sm.createElementWithClassList('div', 'sd-webui-sm-history-preview-summary-header');
            summaryHeader.innerText = 'Changed vs current UI:';
            summaryContainer.appendChild(summaryHeader);
            const summaryList = sm.createElementWithClassList('div', 'sd-webui-sm-history-preview-summary-list');
            const formatSummaryValue = (value) => {
                if (value === undefined || value === null || value === '') {
                    return '-';
                }
                if (typeof value === 'object') {
                    return JSON.stringify(value);
                }
                return `${value}`;
            };
            const formatSummaryLabel = (label) => {
                const trimmedLabel = `${label ?? ''}`.trim();
                const labelMap = {
                    'Sampling method': 'Sampler',
                    'Sampling Method': 'Sampler',
                    'Sampling steps': 'Steps',
                    'Sampling Steps': 'Steps',
                    'Batch count': 'Batch Count',
                    'Batch Count': 'Batch Count',
                    'Batch size': 'Batch Size',
                    'Batch Size': 'Batch Size'
                };
                return labelMap[trimmedLabel] || trimmedLabel;
            };
            const addSummaryDiffs = (currentValues, savedValues, labelResolver) => {
                const seenKeys = new Set();
                const orderedKeys = [...Object.keys(savedValues || {}), ...Object.keys(currentValues || {})].filter((key) => {
                    if (seenKeys.has(key)) {
                        return false;
                    }
                    seenKeys.add(key);
                    return true;
                });
                for (const settingPath of orderedKeys) {
                    const currentValue = currentValues?.[settingPath];
                    const savedValue = savedValues?.[settingPath];
                    if (sm.utils.areLooselyEqualValue(currentValue, savedValue)) {
                        continue;
                    }
                    const label = formatSummaryLabel(labelResolver(settingPath));
                    const summaryRow = sm.createElementWithClassList('div', 'sd-webui-sm-history-preview-summary-row');
                    summaryRow.innerText = `• ${label}: ${formatSummaryValue(currentValue)} → ${formatSummaryValue(savedValue)}`;
                    summaryList.appendChild(summaryRow);
                }
            };
            const quickSettingLabelRenames = {
                'sd_model_checkpoint': 'Checkpoint',
                'sd_vae': 'VAE',
                'CLIP_stop_at_last_layers': 'CLIP skip',
                'sd_hypernetwork': 'Hypernetwork',
            };
            addSummaryDiffs((currentState.quickSettings && typeof currentState.quickSettings === 'object') ? currentState.quickSettings : {}, entry.data.quickSettings && typeof entry.data.quickSettings === 'object' ? entry.data.quickSettings : {}, (settingPath) => quickSettingLabelRenames[settingPath] || sm.getSettingLabelFromPath(settingPath));
            addSummaryDiffs((currentState.componentSettings && typeof currentState.componentSettings === 'object') ? currentState.componentSettings : {}, (entry.data.componentSettings && typeof entry.data.componentSettings === 'object') ? entry.data.componentSettings : {}, (settingPath) => sm.getSettingLabelFromPath(settingPath));
            if (summaryList.childNodes.length == 0) {
                summaryList.innerText = 'No changes vs current UI';
            }
            summaryContainer.appendChild(summaryList);
            sm.inspector.appendChild(summaryContainer);
        }
        sm.inspector.appendChild(metaContainer);
        sm.inspector.appendChild(viewSettingsContainer);
        if (sm.getMode() != 'modal') {
            sm.activeProfileSaveButtons.push(saveChangesButton);
        }
        const quickSettingLabelRenames = {
            'sd_model_checkpoint': 'Checkpoint',
            'sd_vae': 'VAE',
            'CLIP_stop_at_last_layers': 'CLIP skip',
            'sd_hypernetwork': 'Hypernetwork',
        };
        const entryQuickSettings = (entry.data.quickSettings && typeof entry.data.quickSettings === 'object') ? entry.data.quickSettings : {};
        const entryComponentSettings = (entry.data.componentSettings && typeof entry.data.componentSettings === 'object') ? entry.data.componentSettings : {};
        const mandatoryQuickSettings = Object.keys(quickSettingLabelRenames).filter(k => entryQuickSettings.hasOwnProperty(k));
        const miscQuickSettings = Object.keys(entryQuickSettings).filter(k => mandatoryQuickSettings.indexOf(k) == -1);
        function createQuickSetting(label, settingPath) {
            const quickSettingParameter = sm.createInspectorParameter(label, entryQuickSettings[settingPath], () => sm.applyQuickParameters(entryQuickSettings, settingPath), undefined, `quick/${settingPath}`);
            if (sm.inspectorPreviewOnly) {
                const useButton = quickSettingParameter.querySelector('.sd-webui-sm-use-button');
                useButton?.remove?.();
            }
            if (sm.componentMap.hasOwnProperty(settingPath)) {
                quickSettingParameter.dataset['valueDiff'] = (sm.componentMap[settingPath].entries[0].component.instance.$$.ctx[0] == entryQuickSettings[settingPath] ? 'same' : 'changed');
            }
            else {
                quickSettingParameter.dataset['valueDiff'] = 'missing';
            }
            quickSettingsContainer.appendChild(quickSettingParameter);
            return quickSettingParameter;
        }
        const quickSettingsContainer = sm.createElementWithClassList('div', 'sd-webui-sm-inspector-category-content');
        for (let settingName of mandatoryQuickSettings) {
            const quickSettingParameter = createQuickSetting(quickSettingLabelRenames[settingName], settingName);
            if (settingName == 'sd_model_checkpoint') {
                const valueField = quickSettingParameter.querySelector('.param-value');
                const checkpointHash = valueField.innerText.match(/\[[a-f0-9]+\]/g);
                valueField.innerText = valueField.innerText.replace(/\.safetensors|\.ckpt|\[[a-f0-9]+\]/g, '');
                valueField.appendChild(sm.createElementWithInnerTextAndClassList('span', checkpointHash, 'hash'));
            }
        }
        for (let settingName of miscQuickSettings) {
            createQuickSetting(settingName, settingName);
        }
        sm.inspector.appendChild(sm.createInspectorSettingsAccordion('Quick settings', quickSettingsContainer));
        const savedComponentSettings = sm.utils.unflattenSettingsMap(entryComponentSettings);
        const savedComponentDefaults = sm.utils.unflattenSettingsMap(sm.memoryStorage.savedDefaults[entry.data.defaults]);
        let curatedSettingNames = new Set(); // Added manually to Generation accordion e.g.
        // A curated section that displays the core generation params, whether they differ or not
        const generationSettingsContent = sm.createElementWithClassList('div', 'sd-webui-sm-inspector-category-content');
        function getAlternativeSettingPaths(settingPath) {
            const alternatives = [settingPath];
            const rootTypePrefix = `${entry.data.type}/`;
            const appendUnique = (candidate) => {
                if (candidate && alternatives.indexOf(candidate) == -1) {
                    alternatives.push(candidate);
                }
            };
            if (settingPath.startsWith(rootTypePrefix)) {
                const label = settingPath.substring(rootTypePrefix.length);
                const labelVariants = {
                    'Negative prompt': ['Negative Prompt'],
                    'Negative Prompt': ['Negative prompt'],
                    'Sampling method': ['Sampling Method'],
                    'Sampling Method': ['Sampling method'],
                    'Sampling steps': ['Sampling Steps'],
                    'Sampling Steps': ['Sampling steps'],
                    'Batch count': ['Batch Count'],
                    'Batch Count': ['Batch count'],
                    'Batch size': ['Batch Size'],
                    'Batch Size': ['Batch size']
                };
                for (const variant of (labelVariants[label] || [])) {
                    appendUnique(`${rootTypePrefix}${variant}`);
                }
                const samplerLabelMap = {
                    'Sampling method': 'Sampling Method',
                    'Sampling Method': 'Sampling Method',
                    'Sampling steps': 'Sampling Steps',
                    'Sampling Steps': 'Sampling Steps',
                    'Schedule type': 'Schedule Type',
                    'Schedule Type': 'Schedule Type',
                    'Batch count': 'Batch Count',
                    'Batch Count': 'Batch Count',
                    'Batch size': 'Batch Size',
                    'Batch Size': 'Batch Size'
                };
                const samplerLabel = samplerLabelMap[label];
                if (samplerLabel) {
                    appendUnique(`customscript/sampler.py/${entry.data.type}/${samplerLabel}`);
                }
            }
            return alternatives;
        }
        function isMissingPreviewValue(value) {
            return value === undefined || value === null || value === '';
        }
        function getDisplayValue(value, fallback = '-') {
            return isMissingPreviewValue(value) ? fallback : value;
        }
        function resolveSavedValue(settingPath) {
            const defaults = sm.memoryStorage.savedDefaults[entry.data.defaults] || {};
            let foundFallback = null;
            for (const candidate of getAlternativeSettingPaths(settingPath)) {
                if (entryComponentSettings.hasOwnProperty(candidate)) {
                    const value = entryComponentSettings[candidate];
                    if (!isMissingPreviewValue(value)) {
                        return { path: candidate, value: value };
                    }
                    if (!foundFallback) {
                        foundFallback = { path: candidate, value: value };
                    }
                }
                if (defaults.hasOwnProperty(candidate)) {
                    const value = defaults[candidate];
                    if (!isMissingPreviewValue(value)) {
                        return { path: candidate, value: value };
                    }
                    if (!foundFallback) {
                        foundFallback = { path: candidate, value: value };
                    }
                }
            }
            return foundFallback || { path: settingPath, value: undefined };
        }
        function getSavedValue(settingPath) {
            return resolveSavedValue(settingPath).value;
        }
        function createCompositeInspectorParameter(label, displayValueFormatter, settingPaths) {
            settingPaths.forEach(curatedSettingNames.add.bind(curatedSettingNames));
            const resolvedSettingPaths = [];
            const valueMap = settingPaths.reduce((values, settingPath) => {
                const resolved = resolveSavedValue(settingPath);
                values[settingPath] = resolved.value;
                if (resolved.path != settingPath) {
                    values[resolved.path] = resolved.value;
                }
                if (resolvedSettingPaths.indexOf(resolved.path) == -1) {
                    resolvedSettingPaths.push(resolved.path);
                }
                curatedSettingNames.add(resolved.path);
                return values;
            }, {});
            const applyMap = resolvedSettingPaths.reduce((result, path) => {
                result[path] = valueMap[path];
                return result;
            }, {});
            const param = sm.createInspectorParameter(label, displayValueFormatter(valueMap), () => sm.applyComponentSettings(applyMap), () => sm.setValueDiffAttribute(param, ...Object.keys(applyMap).map(p => ({ path: p, value: applyMap[p] }))), `component/${settingPaths.join('|')}`);
            param.update();
            return param;
        }
        function _createGenerationInspectorParameter(label, settingPath, factory) {
            curatedSettingNames.add(settingPath);
            const resolved = resolveSavedValue(settingPath);
            const value = resolved.value;
            curatedSettingNames.add(resolved.path);
            const parameter = factory(label, value, () => sm.applyComponentSettings({ [resolved.path]: value }), () => sm.setValueDiffAttribute(parameter, { path: resolved.path, value: value }), `component/${settingPath}`);
            parameter.update();
            return parameter;
        }
        function createGenerationInspectorPromptParameter(label, settingPath) {
            return _createGenerationInspectorParameter(label, settingPath, sm.createInspectorPromptSection);
        }
        function createGenerationInspectorParameter(label, settingPath) {
            return _createGenerationInspectorParameter(label, settingPath, sm.createInspectorParameter);
        }
        const getRootSettingName = (settingName) => `${entry.data.type}/${settingName}`;
        const getScriptSettingName = (scriptName, settingName) => `customscript/${scriptName}.py/${entry.data.type}/${settingName}`;
        generationSettingsContent.appendChild(createGenerationInspectorPromptParameter('Prompt', getRootSettingName('Prompt')));
        generationSettingsContent.appendChild(createGenerationInspectorPromptParameter('Negative prompt', getRootSettingName('Negative prompt')));
        generationSettingsContent.appendChild(createCompositeInspectorParameter("Sampling", valueMap => `${getDisplayValue(valueMap[getRootSettingName('Sampling method')])} (${getDisplayValue(valueMap[getRootSettingName('Sampling steps')])} steps)`, [getRootSettingName('Sampling method'), getRootSettingName('Sampling steps')]));
        generationSettingsContent.appendChild(createGenerationInspectorParameter("Schedule Type", getRootSettingName('Schedule Type')));
        generationSettingsContent.appendChild(createCompositeInspectorParameter("Size", valueMap => `${getDisplayValue(valueMap[getRootSettingName('Width')])} x ${getDisplayValue(valueMap[getRootSettingName('Height')])}`, [getRootSettingName('Width'), getRootSettingName('Height')]));
        generationSettingsContent.appendChild(createCompositeInspectorParameter("Batches", valueMap => `${getDisplayValue(valueMap[getRootSettingName('Batch count')])} x ${getDisplayValue(valueMap[getRootSettingName('Batch size')])}`, [getRootSettingName('Batch count'), getRootSettingName('Batch size')]));
        generationSettingsContent.appendChild(createGenerationInspectorParameter("CFG Scale", getRootSettingName('CFG Scale')));
        generationSettingsContent.appendChild(createGenerationInspectorParameter("Seed", getScriptSettingName('seed', 'Seed')));
        generationSettingsContent.appendChild(createGenerationInspectorParameter("Use subseed", getScriptSettingName('seed', 'Extra')));
        const hasSubseed = getSavedValue(getScriptSettingName('seed', 'Extra'));
        if (hasSubseed) {
            generationSettingsContent.appendChild(createGenerationInspectorParameter("Variation seed", getScriptSettingName('seed', 'Variation seed')));
            generationSettingsContent.appendChild(createGenerationInspectorParameter("Variation strength", getScriptSettingName('seed', 'Variation strength')));
            generationSettingsContent.appendChild(createCompositeInspectorParameter("Resize seed from size", valueMap => `${valueMap[getScriptSettingName('seed', 'Resize seed from width')]} x ${valueMap[getScriptSettingName('seed', 'Resize seed from height')]}`, [getScriptSettingName('seed', 'Resize seed from width'), getScriptSettingName('seed', 'Resize seed from height')]));
        }
        generationSettingsContent.appendChild(createGenerationInspectorParameter("Hires. fix", getRootSettingName('Hires. fix')));
        generationSettingsContent.appendChild(createGenerationInspectorParameter("Refiner", getScriptSettingName('refiner', 'Refiner')));
        sm.inspector.appendChild(sm.createInspectorSettingsAccordion('Generation', generationSettingsContent));
        const hasHiresFix = getSavedValue(getRootSettingName('Hires. fix'));
        const hasRefiner = getSavedValue(getScriptSettingName('refiner', 'Refiner'));
        if (hasHiresFix) {
            const hiresFixSettingsContent = sm.createElementWithClassList('div', 'sd-webui-sm-inspector-category-content');
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("Enabled", getRootSettingName('Hires. fix')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("Upscaler", getRootSettingName('Upscaler')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("Steps", getRootSettingName('Hires steps')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("CFG Scale", getRootSettingName('Hires CFG Scale')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("Distilled CFG Scale", getRootSettingName('Hires Distilled CFG Scale')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("Denoising strength", getRootSettingName('Denoising strength')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("Upscale by", getRootSettingName('Upscale by')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("Checkpoint", getRootSettingName('Hires checkpoint')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorParameter("Sampling method", getRootSettingName('Hires sampling method')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorPromptParameter('Prompt', getRootSettingName('Hires prompt')));
            hiresFixSettingsContent.appendChild(createGenerationInspectorPromptParameter('Negative prompt', getRootSettingName('Hires negative prompt')));
            sm.inspector.appendChild(sm.createInspectorSettingsAccordion('Hires fix.', hiresFixSettingsContent));
        }
        if (hasRefiner) {
            const refinersSettingsContent = sm.createElementWithClassList('div', 'sd-webui-sm-inspector-category-content');
            refinersSettingsContent.appendChild(createGenerationInspectorParameter("Enabled", getScriptSettingName('refiner', 'Refiner')));
            refinersSettingsContent.appendChild(createGenerationInspectorParameter("Checkpoint", getScriptSettingName('refiner', 'Checkpoint')));
            refinersSettingsContent.appendChild(createGenerationInspectorParameter("Switch at", getScriptSettingName('refiner', 'Switch at')));
            sm.inspector.appendChild(sm.createInspectorSettingsAccordion('Refiner', refinersSettingsContent));
        }
        // Regardless of whether or not we've added Hires fix. or Refiner settings, they shouldn't be added in the xxx2img accordion (if not used, means it was disabled)
        [getRootSettingName('Hires. fix'), getRootSettingName('Upscaler'), getRootSettingName('Hires steps'), getRootSettingName('Hires CFG Scale'), getRootSettingName('Hires Distilled CFG Scale'), getRootSettingName('Denoising strength'), getRootSettingName('Schedule Type'),
            getRootSettingName('Upscale by'), getRootSettingName('Hires checkpoint'), getRootSettingName('Hires sampling method'), getRootSettingName('Hires prompt'),
            getRootSettingName('Hires negative prompt'), getScriptSettingName('refiner', 'Refiner'), getScriptSettingName('refiner', 'Checkpoint'),
            getScriptSettingName('refiner', 'Switch at')
        ].forEach(curatedSettingNames.add.bind(curatedSettingNames));
        /*  merge the saved values (that are different from their associated defaults) *with* their defaults (forming a "target value"),
[]        but only when the resulting value is different from either [current UI value | current UI default]
        
                                                        |       / Target value \       |
        | Setting   | Current UI    | Current Default   | Saved default | Saved value  | Show  |
        ----------------------------------------------------------------------------------------
        | A         | 1             | 1                 | 1             | 7            | 7     |
        | B         | 1             | 1                 | 0             | 0            | 0     |
        | C         | 0             | 1                 | 0             | 0            | 0     |
        | D         | 1             | 0                 | 0             | 0            | 0     |
        | E         | 1             | 1                 | 0             | 1            | NO    |
        | F         | 0             | 0                 | 0             | 0            | NO    |
        */
        // Remove saved values if they're already used, or are equal to both the current UI *and* current default values
        let mergedComponentSettings = savedComponentSettings;
        for (const sectionName in mergedComponentSettings) {
            const savedSettingNames = Object.keys(mergedComponentSettings[sectionName]);
            for (const settingName of savedSettingNames) {
                const value = mergedComponentSettings[sectionName][settingName];
                const settingPath = sectionName.endsWith('.py') ? getScriptSettingName(sectionName.substring(0, sectionName.length - 3), settingName) : `${sectionName}/${settingName}`;
                if (curatedSettingNames.has(settingPath) ||
                    (sm.componentMap.hasOwnProperty(settingPath) && sm.memoryStorage.currentDefault.contents.hasOwnProperty(settingPath) &&
                        sm.componentMap[settingPath].entries.every(e => sm.utils.areLooselyEqualValue(value, sm.getMappedComponentEntryValue(e), sm.memoryStorage.currentDefault.contents[settingPath])))) {
                    delete mergedComponentSettings[sectionName][settingName];
                }
            }
        }
        // Add saved default value if it differs from the current UI *or* current default values, but not if it's already shown elsewhere (or isn't xxx2img-related)
        for (const sectionName in savedComponentDefaults) {
            mergedComponentSettings[sectionName] = mergedComponentSettings[sectionName] || {};
            for (const settingName in savedComponentDefaults[sectionName]) {
                const settingPath = `${sectionName}/${settingName}`;
                if (curatedSettingNames.has(settingPath) || (settingPath.indexOf(`${entry.data.type}`) == -1)) {
                    continue;
                }
                const settingPathInfo = sm.utils.getSettingPathInfo(settingPath);
                // if settingName not in savedComponentSettings,  then 
                if (!mergedComponentSettings[sectionName].hasOwnProperty(settingName)) {
                    if (!sm.componentMap.hasOwnProperty(settingPathInfo.basePath)) { // possibly a rogue setting
                        continue;
                    }
                    const value = savedComponentDefaults[sectionName][settingName];
                    const mappedComponents = sm.componentMap[settingPathInfo.basePath].entries;
                    for (let i = 0; i < mappedComponents.length; i++) {
                        const finalSettingName = mappedComponents.length == 1 ? settingName : `${settingName} ${i}`;
                        if (!sm.utils.areLooselyEqualValue(value, sm.getMappedComponentEntryValue(mappedComponents[i]), sm.memoryStorage.currentDefault.contents[settingPathInfo.basePath])) {
                            mergedComponentSettings[sectionName][finalSettingName] = value;
                        }
                    }
                }
            }
            if (Object.keys(mergedComponentSettings[sectionName]).length == 0) {
                delete mergedComponentSettings[sectionName];
            }
        }
        for (const sectionName in mergedComponentSettings) {
            let prettyLabelName = sectionName;
            prettyLabelName = sectionName.replace(/\.py$/g, '').replaceAll('_', ' ');
            prettyLabelName = prettyLabelName[0].toUpperCase() + prettyLabelName.slice(1);
            const sectionSettings = mergedComponentSettings[sectionName];
            const explicitSectionData = {};
            for (const settingPath in sectionSettings) {
                explicitSectionData[`${sectionName}/${settingPath}`] = sectionSettings[settingPath];
            }
            sm.inspector.appendChild(sm.createInspectorSettingsAccordion(prettyLabelName, explicitSectionData));
        }
        if (sm.getMode() == 'modal') {
            const stickyActionContainer = sm.createElementWithClassList('sd-webui-sm-inspector-save-sticky');
            const stickySaveButton = sm.createElementWithInnerTextAndClassList('button', 'Save Changes', 'sd-webui-sm-inspector-save-button', 'sd-webui-sm-inspector-load-button');
            stickySaveButton.title = canSaveConfigChanges ? "Save edited config settings" : "Save Changes is only available for saved configs";
            stickySaveButton.disabled = !canSaveConfigChanges;
            if (sm.inspectorPreviewOnly) {
                stickySaveButton.style.display = 'none';
                loadAllButton.style.display = 'none';
            }
            stickySaveButton.addEventListener('click', () => sm.saveActiveProfileChanges());
            stickyActionContainer.appendChild(loadAllButton);
            stickyActionContainer.appendChild(stickySaveButton);
            sm.inspector.appendChild(stickyActionContainer);
            sm.activeProfileSaveButtons.push(stickySaveButton);
        }
        sm.refreshActiveProfileDraftState();
    };
    sm.setValueDiffAttribute = function (element, ...settings) {
        element.dataset['valueDiff'] = 'same';
        for (const setting of settings) {
            const settingPathInfo = sm.utils.getSettingPathInfo(setting.path);
            if (sm.componentMap.hasOwnProperty(settingPathInfo.basePath)) {
                if (sm.getMappedComponentEntryValue(sm.componentMap[settingPathInfo.basePath].entries[settingPathInfo.index]) != setting.value) {
                    element.dataset['valueDiff'] = 'changed';
                    break;
                }
            }
            else {
                element.dataset['valueDiff'] = 'missing';
                break;
            }
        }
    };
    sm.applyQuickParameters = async function (values, ...filter) {
        if (!values || typeof values !== 'object') {
            values = {};
        }
        if (filter.length > 0) {
            values = sm.utils.getFilteredObject(values, ...filter);
        }
        return sm.api.post("quicksettings", { contents: JSON.stringify(values) })
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'success') || !response.success) {
                Promise.reject(response);
                return;
            }
            sm.applyComponentSettings(values);
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Applying quicksettings failed with error", e));
    };
    sm.applyComponentSettings = function (settings) {
        for (let componentPath of Object.keys(settings)) {
            const settingPathInfo = sm.utils.getSettingPathInfo(componentPath);
            const resolvedBasePath = sm.resolveComponentPath(settingPathInfo.basePath);
            const componentData = sm.componentMap[resolvedBasePath];
            if (!componentData) {
                console.warn(`[State Manager] Could not apply component path ${settingPathInfo.basePath}`);
                continue;
            }
            sm.setMappedComponentEntryValue(componentData.entries[settingPathInfo.index], settings[componentPath]);
        }
    };
    sm.createInspectorSettingsAccordion = function (label, data) {
        const accordion = sm.createElementWithClassList('div', 'sd-webui-sm-inspector-category', 'block', 'gradio-accordion');
        const sectionLabel = `${label}`.trim();
        accordion.appendChild(sm.createInspectorLabel(label, `accordion/${sectionLabel}`));
        accordion.appendChild(sm.createElementWithInnerTextAndClassList('span', '▼', 'foldout'));
        let content = data;
        if (!(data instanceof HTMLElement)) {
            content = sm.createElementWithClassList('div', 'sd-webui-sm-inspector-category-content');
            for (const settingPath in data) {
                const parameter = sm.createInspectorParameter(settingPath.split('/').slice(1).join('/'), data[settingPath], () => {
                    sm.applyComponentSettings({ [settingPath]: data[settingPath] });
                }, undefined, `component/${settingPath}`);
                sm.setValueDiffAttribute(parameter, { path: settingPath, value: data[settingPath] });
                content.appendChild(parameter);
            }
        }
        const applyButton = sm.createElementWithInnerTextAndClassList('button', `Load ${label}${label.toLowerCase().endsWith('settings') ? '' : ' settings'}`, 'sd-webui-sm-inspector-wide-button', 'sd-webui-sm-inspector-load-button');
        content.appendChild(applyButton);
        if (sm.inspectorPreviewOnly) {
            applyButton.style.display = 'none';
        }
        else {
            applyButton.addEventListener('click', e => {
                if (!sm.canProceedWithApplyAction()) {
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }
                for (const param of applyButton.parentNode.querySelectorAll('.sd-webui-sm-inspector-param:has(:checked)')) {
                    param.apply();
                }
                e.stopPropagation();
                e.preventDefault();
            });
        }
        const isOpen = Boolean(sm.inspectorAccordionState?.[sectionLabel]);
        content.style.height = isOpen ? '100%' : '0';
        accordion.classList.toggle('open', isOpen);
        accordion.appendChild(content);
        accordion.addEventListener('click', () => {
            if (content.style.height == '100%') {
                content.style.height = '0';
                accordion.classList.remove('open');
                sm.inspectorAccordionState[sectionLabel] = false;
            }
            else {
                content.style.height = '100%';
                accordion.classList.add('open');
                sm.inspectorAccordionState[sectionLabel] = true;
            }
            //
        });
        return accordion;
    };
    sm.createInspectorPromptSection = function (label, prompt, onUse, onUIUpdate, checkboxKey) {
        const promptContainer = sm.createElementWithClassList('div', 'prompt-container', 'sd-webui-sm-inspector-param', sm.svelteClasses.prompt);
        promptContainer.apply = onUse;
        promptContainer.update = onUIUpdate;
        const promptField = sm.createElementWithInnerTextAndClassList('textarea', prompt, 'prompt');
        promptField.readOnly = true;
        const promptButtons = sm.createElementWithClassList('div', 'prompt-button-container');
        // const viewPromptButton = sm.createElementWithInnerTextAndClassList('button', '👁'); // todo: bring this back?
        // viewPromptButton.title = "View prompt";
        promptButtons.appendChild(sm.createUseButton(onUse));
        promptButtons.appendChild(sm.createCopyButton(prompt));
        // promptButtons.appendChild(viewPromptButton);
        promptContainer.appendChild(sm.createInspectorLabel(label, checkboxKey));
        promptContainer.appendChild(promptField);
        promptContainer.appendChild(promptButtons);
        promptContainer.addEventListener('click', e => e.stopPropagation());
        return promptContainer;
    };
    sm.createInspectorParameterSection = function (value, onUse) {
        const paramContainer = sm.createElementWithClassList('div', 'param-container');
        const valueString = value?.toString();
        let valueElement;
        if (valueString === 'true') {
            valueElement = sm.createElementWithInnerTextAndClassList('span', '✓', 'param-value', 'true');
        }
        else if (valueString === 'false') {
            valueElement = sm.createElementWithInnerTextAndClassList('span', '✖', 'param-value', 'false');
        }
        else {
            valueElement = sm.createElementWithInnerTextAndClassList('span', valueString, 'param-value');
        }
        paramContainer.appendChild(valueElement);
        const buttonContainer = sm.createElementWithClassList('div', 'button-container');
        buttonContainer.appendChild(sm.createUseButton(onUse));
        buttonContainer.appendChild(sm.createCopyButton(value));
        paramContainer.appendChild(buttonContainer);
        paramContainer.apply = onUse;
        return paramContainer;
    };
    sm.createInspectorSideButton = function (innerText, title, onClick) {
        const button = sm.createElementWithInnerTextAndClassList('button', innerText);
        button.title = title;
        button.addEventListener('click', e => {
            onClick();
            e.stopPropagation();
        });
        return button;
    };
    sm.createUseButton = function (onUse) {
        if (sm.inspectorPreviewOnly) {
            const previewOnlyButton = sm.createInspectorSideButton('↙️', 'Preview only', () => { });
            previewOnlyButton.style.display = 'none';
            return previewOnlyButton;
        }
        return sm.createInspectorSideButton('↙️', "Apply to prompt (overrides current)", () => {
            if (!sm.canProceedWithApplyAction()) {
                return;
            }
            onUse();
        }); //alt 📋, ↙️, 🔖, or 🗳
    };
    sm.createCopyButton = function (value) {
        return sm.createInspectorSideButton('📄', "Copy to clipboard", () => navigator.clipboard.writeText(value.toString())); //alt 📋
    };
    sm.createInspectorLabel = function (label, checkboxKey, defaultChecked = true) {
        const labelWithCheckbox = sm.createElementWithClassList('span', 'label-container');
        const checkbox = sm.createElementWithClassList('input', 'param-checkbox', sm.svelteClasses.checkbox);
        checkbox.type = 'checkbox';
        checkbox.checked = sm.getActiveProfileCheckboxState(checkboxKey, defaultChecked);
        if (checkboxKey) {
            checkbox.dataset['profileSettingKey'] = checkboxKey;
        }
        checkbox.addEventListener('click', e => e.stopPropagation());
        checkbox.addEventListener('change', e => {
            sm.setActiveProfileCheckboxState(checkbox.dataset['profileSettingKey'], checkbox.checked);
            e.stopPropagation();
        });
        labelWithCheckbox.appendChild(checkbox);
        labelWithCheckbox.appendChild(sm.createElementWithInnerTextAndClassList('span', label, 'label'));
        return labelWithCheckbox;
    };
    sm.createInspectorParameter = function (label, value, onUse, onUIUpdate, checkboxKey) {
        const paramContainer = sm.createElementWithClassList('div', 'sd-webui-sm-inspector-param');
        paramContainer.apply = onUse;
        paramContainer.update = onUIUpdate || (() => { });
        paramContainer.appendChild(sm.createInspectorLabel(label, checkboxKey));
        paramContainer.appendChild(sm.createInspectorParameterSection(value, onUse));
        return paramContainer;
    };
    sm.getGalleryPreviews = function () {
        return gradioApp().querySelectorAll('div[id^="tab_"] div[id$="_results"] .thumbnail-item > img');
    };
    sm.getCurrentState = async function (type) {
        return {
            saveVersion: sm.version,
            type: type, // txt2img | img2img
            defaults: sm.memoryStorage.currentDefault.hash,
            quickSettings: await sm.getQuickSettings(),
            componentSettings: sm.getComponentSettings(type, true),
            preview: sm.createPreviewImageData()
        };
    };
    sm.saveState = function (state, group) {
        state.createdAt = Date.now();
        state.groups = [group];
        sm.memoryStorage.entries.data[state.createdAt] = state;
        sm.memoryStorage.entries.updateKeys();
        if (group == 'favourites') {
            sm.appendFavouritesOrderKey?.(`${state.createdAt}`);
        }
        sm.updateStorage();
    };
    sm.deleteStates = function (requireConfirmation, ...stateKeys) {
        const shouldDelete = !requireConfirmation || confirm(`Delete ${stateKeys.length} item${stateKeys.length == 1 ? '' : 's'}? This action cannot be undone.`);
        if (!shouldDelete) {
            return false;
        }
        for (const key of stateKeys) {
            sm.removeFavouritesOrderKey?.(`${key ?? ''}`);
            delete sm.memoryStorage.entries.data[key];
        }
        sm.memoryStorage.entries.updateKeys();
        sm.updateStorage();
        return true;
    };
    sm.addStateToGroup = function (stateKey, group) {
        let state = sm.memoryStorage.entries.data[stateKey];
        state.groups = state.groups || [group];
        if (state.groups.indexOf(group) == -1) {
            state.groups.push(group);
        }
        if (group == 'favourites') {
            sm.appendFavouritesOrderKey?.(`${stateKey ?? ''}`);
        }
        sm.updateStorage();
    };
    sm.removeStateFromGroup = function (stateKey, group) {
        let state = sm.memoryStorage.entries.data[stateKey];
        if (!('groups' in state) || !state.groups) {
            return;
        }
        const groupIndex = state.groups.indexOf(group);
        if (groupIndex > -1) { // It was in this group
            state.groups.splice(groupIndex, 1);
            if (group == 'favourites') {
                sm.removeFavouritesOrderKey?.(`${stateKey ?? ''}`);
            }
            if (state.groups.length == 0) {
                delete sm.memoryStorage.entries.data[stateKey];
                sm.memoryStorage.entries.updateKeys();
            }
        }
        sm.updateStorage();
    };
    sm.setStateName = function (stateKey, name) {
        sm.memoryStorage.entries.data[stateKey].name = name;
        sm.queueStorageUpdate();
    };
    sm.getSettingLabelFromPath = function (settingPath) {
        const settingPathInfo = sm.utils.getSettingPathInfo(`${settingPath ?? ''}`);
        const pathParts = settingPathInfo.basePath.split('/');
        return `${pathParts[pathParts.length - 1] ?? ''}`.trim();
    };
    sm.resolveComponentPath = function (settingPath) {
        const basePath = sm.utils.getSettingPathInfo(`${settingPath ?? ''}`).basePath;
        const candidates = [basePath];
        const appendCandidate = (path) => {
            if (path && candidates.indexOf(path) == -1) {
                candidates.push(path);
            }
        };
        const explicitAliases = {
            'txt2img/Sampling method': ['customscript/sampler.py/txt2img/Sampling Method'],
            'txt2img/Sampling Method': ['customscript/sampler.py/txt2img/Sampling Method'],
            'txt2img/Sampling steps': ['customscript/sampler.py/txt2img/Sampling Steps'],
            'txt2img/Sampling Steps': ['customscript/sampler.py/txt2img/Sampling Steps'],
            'txt2img/Schedule type': ['customscript/sampler.py/txt2img/Schedule Type'],
            'txt2img/Schedule Type': ['customscript/sampler.py/txt2img/Schedule Type'],
            'img2img/Sampling method': ['customscript/sampler.py/img2img/Sampling Method'],
            'img2img/Sampling Method': ['customscript/sampler.py/img2img/Sampling Method'],
            'img2img/Sampling steps': ['customscript/sampler.py/img2img/Sampling Steps'],
            'img2img/Sampling Steps': ['customscript/sampler.py/img2img/Sampling Steps'],
            'img2img/Schedule type': ['customscript/sampler.py/img2img/Schedule Type'],
            'img2img/Schedule Type': ['customscript/sampler.py/img2img/Schedule Type'],
            'txt2img/Hires CFG Scale': ['txt2img/Hires CFG scale'],
            'txt2img/Hires Distilled CFG Scale': ['txt2img/Hires Distilled CFG scale'],
            'img2img/Hires CFG Scale': ['img2img/Hires CFG scale'],
            'img2img/Hires Distilled CFG Scale': ['img2img/Hires Distilled CFG scale']
        };
        for (const alias of (explicitAliases[basePath] || [])) {
            appendCandidate(alias);
        }
        for (const candidate of candidates) {
            if (sm.componentMap.hasOwnProperty(candidate)) {
                return candidate;
            }
            const lowerCandidate = candidate.toLowerCase();
            for (const mappedPath of Object.keys(sm.componentMap)) {
                if (mappedPath.toLowerCase() == lowerCandidate) {
                    return mappedPath;
                }
            }
        }
        return basePath;
    };
    sm.findElementBySelectorOrFallback = function (settingPath) {
        // Priority 1: Check explicit Forge Neo selector map
        const selector = sm.forgeNeoSelectorMap?.[settingPath];
        if (selector) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
            console.warn(`[State Manager] Forge Neo selector map contains selector for '${settingPath}' but element not found: ${selector}`);
        }

        // Priority 2: Fallback to ui-config.json DOM query
        return sm.findUiConfigFallbackInput(settingPath);
    };
    sm.findUiConfigFallbackInput = function (settingPath) {
        const settingPathInfo = sm.utils.getSettingPathInfo(`${settingPath ?? ''}`);
        const pathParts = settingPathInfo.basePath.split('/');
        const generationType = `${pathParts[0] ?? ''}`;
        if (generationType != 'txt2img' && generationType != 'img2img') {
            return null;
        }
        const labelText = sm.getSettingLabelFromPath(settingPathInfo.basePath);
        if (!labelText) {
            return null;
        }
        const tabContainer = app.getElementById(`tab_${generationType}`) || app.querySelector(`#${generationType}`);
        if (!tabContainer) {
            return null;
        }
        const targetLabel = labelText.replace(/\s+/g, ' ').trim().replace(/:$/, '').toLowerCase();
        const labelCandidates = tabContainer.querySelectorAll('label, .block-title, .name, .label');
        for (const labelNode of labelCandidates) {
            const candidateText = `${labelNode.textContent ?? ''}`.replace(/\s+/g, ' ').trim().replace(/:$/, '').toLowerCase();
            if (candidateText != targetLabel) {
                continue;
            }
            const container = labelNode.closest('.gradio-row, .form, .block, .wrap, .gr-box, .gr-panel') || labelNode.parentElement;
            if (!container) {
                continue;
            }
            const primaryInput = container.querySelector('input[type="number"], textarea, select, input[type="text"], input[type="range"], input[type="checkbox"]');
            if (primaryInput) {
                return primaryInput;
            }
        }
        return null;
    };
    sm.getMappedComponentEntryValue = function (entry) {
        if (!entry) {
            return undefined;
        }
        if (entry.source == 'ui-config') {
            const element = sm.findElementBySelectorOrFallback(entry.path);
            if (!element) {
                return undefined;
            }
            if (element instanceof HTMLInputElement) {
                if (element.type == 'checkbox') {
                    return element.checked;
                }
                if (element.type == 'number' || element.type == 'range') {
                    const value = Number(element.value);
                    return Number.isNaN(value) ? element.value : value;
                }
                return element.value;
            }
            if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
                return element.value;
            }
            return undefined;
        }
        const componentValue = entry.component?.props?.value;
        if (componentValue !== undefined) {
            return componentValue;
        }
        // Forge Neo InputAccordionImpl and some custom wrappers don't always expose props.value.
        // Try common Gradio/Svelte instance contexts before falling back to DOM extraction.
        const instanceContextValue = entry.component?.instance?.$$?.ctx?.[0];
        if (instanceContextValue !== undefined) {
            return instanceContextValue;
        }
        const element = entry.element;
        if (element instanceof HTMLInputElement) {
            if (element.type == 'checkbox') {
                return element.checked;
            }
            if (element.type == 'number' || element.type == 'range') {
                const value = Number(element.value);
                return Number.isNaN(value) ? element.value : value;
            }
            return element.value;
        }
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
            return element.value;
        }
        const nestedInput = element?.querySelector?.('textarea, input[type="text"], input[type="number"], input[type="range"], select, input[type="checkbox"]');
        if (nestedInput instanceof HTMLInputElement) {
            if (nestedInput.type == 'checkbox') {
                return nestedInput.checked;
            }
            if (nestedInput.type == 'number' || nestedInput.type == 'range') {
                const value = Number(nestedInput.value);
                return Number.isNaN(value) ? nestedInput.value : value;
            }
            return nestedInput.value;
        }
        if (nestedInput instanceof HTMLTextAreaElement || nestedInput instanceof HTMLSelectElement) {
            return nestedInput.value;
        }
        return undefined;
    };
    sm.setMappedComponentEntryValue = function (entry, value) {
        if (!entry) {
            return;
        }
        if (entry.source == 'ui-config') {
            const element = sm.findElementBySelectorOrFallback(entry.path);
            if (!element) {
                console.warn(`[State Manager] Could not find element for ${entry.path} (tried explicit selector and ui-config fallback)`);
                return;
            }
            if (element instanceof HTMLInputElement) {
                if (element.type == 'checkbox') {
                    element.checked = Boolean(value);
                }
                else {
                    element.value = `${value ?? ''}`;
                }
            }
            else if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
                element.value = `${value ?? ''}`;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
        entry.component.props.value = value;
        entry.component.instance.$set({ value: entry.component.props.value });
        const e = new Event('change', { bubbles: true });
        Object.defineProperty(e, 'target', { value: entry.element });
        entry.element.dispatchEvent(e);
    };

    sm.fetchForgeNeoSelectors = async function () {
        return sm.api.get("forgeneomap")
            .then(response => {
            if (!sm.utils.isValidResponse(response)) {
                console.warn("[State Manager] Could not fetch Forge Neo selector map, fallback mechanism will rely on ui-config.json only");
                sm.forgeNeoSelectorMap = {};
                return;
            }
            sm.forgeNeoSelectorMap = response;
            console.log("[State Manager] Loaded Forge Neo selector map with", Object.keys(response).length, "entries");
        })
            .catch(e => {
            console.warn("[State Manager] Failed to fetch Forge Neo selector map:", e);
            sm.forgeNeoSelectorMap = {};
        });
    };

    sm.buildComponentMap = async function () {
        return sm.api.get("componentids")
            .then(response => {
            if (!sm.utils.isValidResponse(response)) {
                Promise.reject(response);
                return;
            }
            sm.componentMap = {};
            const components = gradio_config.components || [];
            const componentsById = new Map();
            const componentsByElemId = new Map();
            for (const component of components) {
                componentsById.set(component.id, component);
                if (component.props.elem_id) {
                    componentsByElemId.set(component.props.elem_id, component);
                }
            }
            for (const path in response) {
                const responseData = response[path];
                const source = (typeof responseData === 'object' && responseData) ? `${responseData.source ?? 'gradio'}` : 'gradio';
                const componentId = (typeof responseData === 'object' && responseData) ? responseData.id : responseData;
                const pathParts = path.split('/');
                if (pathParts[pathParts.length - 1] != 'value') {
                    continue; // Skip other settings like min/max if they sneak in here
                }
                const basePath = pathParts.slice(0, pathParts.length - 1).join('/');
                if (source == 'ui-config') {
                    if (!sm.componentMap.hasOwnProperty(basePath)) {
                        sm.componentMap[basePath] = {
                            entries: [{
                                    source: 'ui-config',
                                    path: basePath
                                }]
                        };
                    }
                    continue;
                }
                const component = componentsById.get(componentId);
                if (!component) {
                    continue;
                }
                let data = {
                    entries: [{
                            source: 'gradio',
                            path: basePath,
                            component: component,
                            element: app.getElementById(component.props.elem_id || `component-${component.id}`)
                        }]
                };
                // I really, REALLY dislike adding exception cases for specific extensions, but ControlNet's such a pivotal one...
                // The problem is each unit refers to the same default component path, and we only get returned unit 0 in the list of mapped components from Py
                if (component.props.elem_id?.indexOf('controlnet_ControlNet-0_') > -1) {
                    for (let i = 1; i < 3; i++) {
                        const unitElemId = component.props.elem_id.replace('ControlNet-0_', `ControlNet-${i}_`);
                        const unitComponent = componentsByElemId.get(unitElemId);
                        if (!unitComponent) {
                            continue;
                        }
                        data.entries.push({
                            source: 'gradio',
                            path: basePath,
                            component: unitComponent,
                            element: app.getElementById(unitElemId)
                        });
                    }
                }
                sm.componentMap[basePath] = data;
            }
            // Input accordions extend from gr.Checkbox, where an opened accordion = enabled and closed = disabled
            // They also contain a separate checkbox to override this behaviour, called `xxx-visible-checkbox`
            // To make matters worse, the refiner is just called `txt2img_enable`, and doesn't add itself to the monitored components
            // Since there's no way to retrieve the refiner property path from the accordion, I'm just gonna manually hack those in for now
            const inputAccordions = document.querySelectorAll('#tab_txt2img .input-accordion, #tab_img2img .input-accordion');
            for (const accordion of inputAccordions) {
                const component = componentsByElemId.get(accordion.id);
                const checkbox = accordion.parentElement.querySelector(`#${accordion.id}-checkbox`);
                const visibleCheckbox = accordion.parentElement.querySelector(`#${accordion.id}-visible-checkbox`);
                if (!component || !checkbox || !visibleCheckbox) {
                    console.warn(`[State Manager] An input accordion with an unexpected layout or naming was found (id: ${accordion.id})`);
                    continue;
                }
                let data = sm.componentMap[`${accordion.id.split('_')[0]}/${component.label}`];
                if (!data) {
                    data = {
                        entries: [{
                                source: 'gradio',
                                path: `${accordion.id.split('_')[0]}/${component.label}`,
                                component: component,
                                element: checkbox
                            }]
                    };
                    switch (accordion.id) {
                        case 'txt2img_enable':
                            sm.componentMap['customscript/refiner.py/txt2img/Refiner'] = data;
                            break;
                        case 'img2img_enable':
                            sm.componentMap['customscript/refiner.py/img2img/Refiner'] = data;
                            break;
                    }
                }
                // We could use data.element.addEventListener("change", ...) here, but I don't like the idea of adding a "global" listener
                // like that, that extends outside the scope of this extension. Thus, a hacky data.onchange() that we call manually. Neat.
                data.onChange = () => {
                    visibleCheckbox.checked = data.entries[0].element.checked;
                };
            }
            for (const component of components) { // {path: id}
                if (!component.props.elem_id?.startsWith('setting_')) {
                    continue;
                }
                let data = {
                    entries: [{
                            source: 'gradio',
                            path: component.props.elem_id.substring(8),
                            component: component,
                            element: app.getElementById(component.props.elem_id)
                        }]
                };
                sm.componentMap[component.props.elem_id.substring(8)] = data; // strips "setting_" so we get sm.componentMap['sd_model_checkpoint'] e.g.
            }
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting component IDs failed with error", e));
    };
    sm.getFromStorage = async function () {
        return sm.api.get("savelocation")
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'location')) {
                Promise.reject(response);
                return;
            }
            if (response.location == 'File') {
                return sm.getFileStorage();
            }
            else {
                return sm.getLocalStorage();
            }
        })
            .then(sm.processStorageData)
            .catch(e => sm.utils.logResponseError("[State Manager] Getting storage failed with error", e));
    };
    sm.processStorageData = async function (storedData) {
        if (sm.utils.isEmptyObject(storedData) || storedData == "") {
            return {
                defaults: {},
                favouritesOrder: [],
                entries: {}
            };
        }
        let bytes = storedData;
        if (!(storedData instanceof Uint8Array)) { // Data is in "legacy" SM 1.0 format
            bytes = Uint8Array.from(JSON.parse(storedData));
        }
        const decompressed = await sm.utils.decompress(bytes);
        return JSON.parse(decompressed) || {
            defaults: {},
            favouritesOrder: [],
            entries: {}
        };
    };
    sm.getLocalStorage = async function () {
        const promise = new Promise(function (resolve, _reject) {
            sm.ldb.get('sd-webui-state-manager-data', storedData => {
                if (storedData == null || storedData == '[]' || storedData == '') {
                    storedData = {};
                }
                resolve(storedData);
            });
        });
        return promise;
    };
    sm.getFileStorage = async function () {
        return sm.api.get("filedata")
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'data')) {
                Promise.reject(response);
            }
            else {
                return response.data || {
                    defaults: {},
                    favouritesOrder: [],
                    entries: {}
                };
            }
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting file storage failed with error", e));
    };
    sm.updateStorage = async function () {
        if (updateStorageDebounceHandle != null) {
            clearTimeout(updateStorageDebounceHandle);
            updateStorageDebounceHandle = null;
        }
        sm.api.get("savelocation")
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'location')) {
                Promise.reject(response);
            }
            else if (response.location == 'File') {
                sm.updateFileStorage();
            }
            else {
                sm.updateLocalStorage();
            }
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Updating storage failed with error", e));
    };
    sm.updateLocalStorage = async function (compressedData) {
        if (compressedData == undefined) {
            compressedData = await sm.getCompressedMemoryStorage();
        }
        sm.ldb.set('sd-webui-state-manager-data', compressedData);
    };
    sm.updateFileStorage = async function (compressedData) {
        if (compressedData == undefined) {
            compressedData = await sm.getCompressedMemoryStorage();
        }
        let payloadStringifiedArray = JSON.stringify(Array.from(compressedData));
        return sm.api.post("save", { contents: payloadStringifiedArray.substring(1, payloadStringifiedArray.length - 1) })
            .catch(e => sm.utils.logResponseError("[State Manager] Saving to file storage failed with error", e));
    };
    sm.getCompressedMemoryStorage = async function () {
        // We compress the raw JSON using gzip and store that.
        // I couldn't be bothered to test this with real-world data, but I *strongly* suspect this is a more space-efficient way
        // due to the great amounts of repetition in entry strings (such as 'SDE++ 2M Karras' and `longCheckpointMixNameV1.23 [3942ab99c]` e.g.)
        const compressed = await sm.utils.compress(JSON.stringify({
            defaults: sm.memoryStorage.savedDefaults,
            favouritesOrder: sm.memoryStorage.favouritesOrder,
            entries: sm.memoryStorage.entries.data
        }));
        return compressed;
    };
    sm.initMemoryStorage = async function (storedData) {
        if (!storedData.hasOwnProperty('defaults')) {
            sm.legacyData = storedData;
            return;
        }
        sm.memoryStorage = {
            currentDefault: null,
            savedDefaults: storedData.defaults || {},
            favouritesOrder: [],
            entries: {
                data: storedData.entries || {},
                orderedKeys: [],
                updateKeys: function () {
                    sm.memoryStorage.entries.orderedKeys = Object.keys(sm.memoryStorage.entries.data);
                    sm.memoryStorage.entries.orderedKeys.sort().reverse();
                }
            }
        };
        sm.memoryStorage.entries.updateKeys();
        sm.memoryStorage.favouritesOrder = sm.getNormalisedFavouritesOrder(storedData.favouritesOrder);
        // Load default UI settings
        // sm.inspector.innerHTML = "Loading current UI defaults...";
        return sm.api.get("uidefaults")
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'hash', 'contents')) {
                Promise.reject(response);
                return;
            }
            let contents = {};
            for (const path of Object.keys(response.contents)) {
                const pathParts = path.split('/');
                if (pathParts[pathParts.length - 1] != 'value') {
                    continue; // Skip other settings like min/max if they sneak in here
                }
                contents[pathParts.slice(0, pathParts.length - 1).join('/')] = response.contents[path];
            }
            const currentDefault = {
                hash: response.hash,
                contents: contents
            };
            sm.memoryStorage.currentDefault = currentDefault;
            sm.memoryStorage.savedDefaults[currentDefault.hash] = contents;
            // sm.inspector.innerHTML = "";
            // sm.updateInspector();
        })
            .catch(e => {
            // sm.inspector.innerHTML = "There was an error loading current UI defaults. Please reload the UI (refresh the page).";
            sm.utils.logResponseError("[State Manager] Getting UI defaults failed with error", e);
        });
    };
    sm.syncStorage = function (direction, type) {
        return sm.api.get("savelocation")
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'saveFile')) {
                Promise.reject(response);
                return;
            }
            const sources = ["this browser's Indexed DB", `the shared ${response.saveFile} file`];
            const warning = type == 'merge' ?
                `merge the entries of both ${sources[0]} and ${sources[1]}, and write the result to ${direction == 'idb2file' ? "this file" : "the Indexed DB"}` :
                `override the entries of ${sources[direction == 'idb2file' ? 1 : 0]} with the contents of ${sources[direction == 'idb2file' ? 0 : 1]}`;
            if (!confirm(`You are about to ${warning}. This operation can not be undone! Are you sure you wish to continue?`)) {
                return;
            }
            (direction == 'idb2file' ? sm.getLocalStorage() : sm.getFileStorage())
                .then(d => {
                return sm.processStorageData(d);
            })
                .then(sourceData => {
                if (type == 'overwrite') {
                    return sourceData;
                }
                else {
                    return (direction == 'idb2file' ? sm.getFileStorage() : sm.getLocalStorage())
                        .then(sm.processStorageData)
                        .then(destinationData => {
                        Object.assign(destinationData, sourceData);
                        Object.assign(destinationData.defaults, sourceData.defaults);
                        Object.assign(destinationData.entries, sourceData.entries);
                        return destinationData;
                    })
                        .catch(e => sm.utils.logResponseError("[State Manager] Could not merge data", e));
                }
            })
                .then(destinationData => {
                return sm.utils.compress(JSON.stringify(destinationData));
            })
                .then(compressedDestinationData => {
                if (direction == 'idb2file') {
                    sm.updateFileStorage(compressedDestinationData);
                }
                else {
                    sm.updateLocalStorage(compressedDestinationData);
                }
            })
                .catch(e => sm.utils.logResponseError("[State Manager] Could not sync data", e));
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting save file name failed with error", e));
    };
    sm.getStateData = function (group) {
        let result = [];
        for (let key of sm.memoryStorage.entries.orderedKeys) {
            const data = sm.memoryStorage.entries.data[key];
            if (!group || group == 'all' || ((data.groups?.indexOf(group) ?? -1) > -1)) {
                result.push(data);
            }
        }
        return result;
    };
    sm.clearHistory = function () {
        if (!confirm(`Warning! You are about to delete all entries that are not saved as configs and do not have a name. This operation can not be undone! Are you sure you wish to continue?`)) {
            return;
        }
        for (const key of sm.memoryStorage.entries.orderedKeys) {
            const data = sm.memoryStorage.entries.data[key];
            if (!data.groups || (data.groups.length == 1 && data.groups[0] == 'history' && (!data.hasOwnProperty('name') || data.name == ''))) {
                delete sm.memoryStorage.entries.data[key];
            }
        }
        sm.memoryStorage.entries.updateKeys();
        sm.updateStorage();
    };
    sm.clearData = function (location) {
        sm.api.get("savelocation")
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'location', 'saveFile')) {
                Promise.reject(response);
                return;
            }
            const sources = ["this browser's Indexed DB", `the shared ${response.saveFile} file`];
            if (!confirm(`Warning! You are about to delete ALL entries from ${sources[location == 'Browser\'s Indexed DB' ? 0 : 1]}. This operation can not be undone! Are you sure you wish to continue?`)) {
                return;
            }
            function ensureMemoryStorageIsSynced() {
                if (response.location == location) {
                    sm.initMemoryStorage({});
                    sm.updateEntries();
                }
            }
            if (location == 'File') {
                sm.updateFileStorage([])
                    .then(() => {
                    console.log("[State Manager] Succesfully deleted all File entries");
                    sm.api.post("showmodal", { type: 'info', contents: `${response.saveFile} has been cleared` });
                    ensureMemoryStorageIsSynced();
                })
                    .catch(e => sm.utils.logResponseError("[State Manager] Clearing File entries failed with error", e));
            }
            else {
                sm.updateLocalStorage([]);
                console.log("[State Manager] Succesfully deleted all IDB entries");
                sm.api.post("showmodal", { type: 'info', contents: "IDB has been cleared" });
                ensureMemoryStorageIsSynced();
            }
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting save file name failed with error", e));
    };
    sm.applyAll = function (state) {
        if (!sm.canProceedWithApplyAction()) {
            return;
        }
        const quickSettings = (state.quickSettings && typeof state.quickSettings === 'object') ? state.quickSettings : {};
        sm.applyQuickParameters(quickSettings); // The 4 mandatory ones always get saved, any other relevant ones will be in here. Easy!
        const savedComponentDefaults = sm.memoryStorage.savedDefaults[state.defaults];
        let mergedComponentSettings = (state.componentSettings && typeof state.componentSettings === 'object') ? state.componentSettings : {};
        // Add saved default value if it differs from the current UI
        for (const settingPath in savedComponentDefaults) {
            if (settingPath.indexOf(state.type) == -1) {
                continue;
            }
            if (!mergedComponentSettings.hasOwnProperty(settingPath)) {
                if (!sm.componentMap.hasOwnProperty(settingPath)) { // rogue setting
                    continue;
                }
                const value = savedComponentDefaults[settingPath];
                const mappedComponents = sm.componentMap[settingPath].entries;
                for (let i = 0; i < mappedComponents.length; i++) {
                    if (!sm.utils.areLooselyEqualValue(value, sm.getMappedComponentEntryValue(mappedComponents[i]))) {
                        mergedComponentSettings[mappedComponents.length == 1 ? settingPath : `${settingPath}/${i}`] = value;
                    }
                }
            }
        }
        sm.applyComponentSettings(mergedComponentSettings);
    };
    sm.applyStartupConfigIfEnabled = function () {
        if (sm.hasAppliedStartupConfig) {
            return;
        }
        sm.hasAppliedStartupConfig = true;
        const startupConfigStateKey = `${sm.uiSettings.startupConfigStateKey ?? ''}`;
        if (startupConfigStateKey.length == 0) {
            return;
        }
        const startupConfig = sm.memoryStorage?.entries?.data?.[startupConfigStateKey];
        if (!startupConfig || (startupConfig.groups?.indexOf('favourites') ?? -1) == -1) {
            sm.uiSettings.startupConfigStateKey = '';
            sm.saveUISettings();
            sm.syncStartupConfigSettingsControls?.();
            return;
        }
        sm.applyAll(startupConfig);
    };
    sm.getQuickSettings = async function () {
        return sm.api.get("quicksettings")
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'settings')) {
                Promise.reject(response);
            }
            return response.settings;
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting quicksettings failed with error", e));
    };
    sm.getComponentSettings = function (type, changedOnly = true) {
        let settings = {};
        // let noComponentFoundSettings: string[] = [];
        for (const componentPath of Object.keys(sm.memoryStorage.currentDefault.contents)) {
            const resolvedComponentPath = sm.resolveComponentPath(componentPath);
            const componentData = sm.componentMap[resolvedComponentPath];
            if (!componentData) {
                // noComponentFoundSettings.push(componentPath);
                continue;
            }
            const reType = new RegExp(`(^|\/)${type}/`);
            if (reType.test(componentPath)) {
                for (let i = 0; i < componentData.entries.length; i++) {
                    const finalComponentPath = componentData.entries.length == 1 ? componentPath : `${componentPath}/${i}`;
                    const currentValue = sm.getMappedComponentEntryValue(componentData.entries[i]);
                    if (!changedOnly || (sm.memoryStorage.currentDefault.contents[finalComponentPath] != currentValue)) {
                        settings[finalComponentPath] = currentValue;
                    }
                }
            }
        }
        return settings;
    };
    sm.createPreviewImageData = function () {
        if (!sm.lastHeadImage) {
            return null;
        }
        const galleryPreviews = sm.getGalleryPreviews();
        const image = (galleryPreviews.length > 1 && galleryPreviews[0].src.includes("grids/")) ? galleryPreviews[1] : galleryPreviews[0];
        if (!image) {
            return null;
        }
        // const imageSize = {x: 100, y: 100};
        const scale = previewImageMaxSize / Math.max(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        // Set width and height
        canvas.width = image.naturalWidth * scale;
        canvas.height = image.naturalHeight * scale;
        // Draw image and export to a data-uri.
        // Prefer WebP for smaller previews; fall back to PNG if WebP isn't supported.
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const webpDataURI = canvas.toDataURL('image/webp', 0.9);
        const dataURI = webpDataURI.startsWith('data:image/webp') ? webpDataURI : canvas.toDataURL();
        return dataURI;
    };
    sm.createPreviewImageDataFromSource = function (imageSource) {
        return new Promise(resolve => {
            if (!imageSource || imageSource.length == 0) {
                resolve(null);
                return;
            }
            const image = new Image();
            image.onload = () => {
                const scale = previewImageMaxSize / Math.max(image.naturalWidth, image.naturalHeight);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }
                canvas.width = image.naturalWidth * scale;
                canvas.height = image.naturalHeight * scale;
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                const webpDataURI = canvas.toDataURL('image/webp', 0.9);
                const dataURI = webpDataURI.startsWith('data:image/webp') ? webpDataURI : canvas.toDataURL();
                resolve(dataURI);
            };
            image.onerror = () => resolve(null);
            image.src = imageSource;
        });
    };
    sm.createPreviewImageDataFromFile = function (file) {
        return new Promise(resolve => {
            const fileReader = new FileReader();
            fileReader.onload = async () => {
                resolve(await sm.createPreviewImageDataFromSource(`${fileReader.result ?? ''}`));
            };
            fileReader.onerror = () => resolve(null);
            fileReader.readAsDataURL(file);
        });
    };
    sm.createElementWithClassList = function (tagName, ...classes) {
        const element = document.createElement(tagName);
        for (const className of classes) {
            element.classList.add(className);
        }
        return element;
    };
    sm.createElementWithInnerTextAndClassList = function (tagName, innerText, ...classes) {
        const element = sm.createElementWithClassList(tagName, ...classes);
        element.innerText = innerText;
        return element;
    };
    // Stolen from `notification.js`, but can't use same `headImg`. Really wish webui had more callbacks
    sm.checkHeadImage = function () {
        sm.mountPanelContainer();
        const galleryPreviews = sm.getGalleryPreviews();
        if (galleryPreviews == null)
            return;
        const headImage = galleryPreviews[0]?.src;
        if (headImage == null || headImage == sm.lastHeadImage)
            return;
        sm.lastHeadImage = headImage;
        if (sm.autoSaveHistory) {
            sm.saveLastUsedState();
        }
    };
    sm.saveLastUsedState = function (group = 'history') {
        if (!sm.lastUsedState) {
            alert("No previous state found.");
            return;
        }
        sm.lastUsedState.preview = sm.createPreviewImageData();
        const seedPath = `customscript/seed.py/${sm.lastUsedState.type}/Seed`;
        if (!sm.lastUsedState.componentSettings.hasOwnProperty(seedPath) || sm.lastUsedState.componentSettings[seedPath] == -1) { // Try and grab the actual seed used
            let seedFromHTMLInfo = Number(app.querySelector(`#html_info_${sm.lastUsedState.type} p`).innerText.match(/Seed: (\d+)/)[1]);
            const selectedThumbnail = app.querySelector(`#${sm.lastUsedState.type.type}_gallery .thumbnail-item.selected`);
            // If we've got thumbnail i selected, then 0 = grid (seed N), 1 = first image (seed N), 2 = second image (seed N+1), ...
            if (selectedThumbnail != undefined) {
                const thumbnailIndex = Array.prototype.indexOf.call(selectedThumbnail.parentNode.children, selectedThumbnail);
                seedFromHTMLInfo -= Math.max(thumbnailIndex - 1, 0);
            }
            sm.lastUsedState.componentSettings[seedPath] = seedFromHTMLInfo;
        }
        sm.saveState(sm.lastUsedState, group);
        if (sm.entryFilter.group == group) {
            sm.updateEntries();
        }
    };
    sm.api = {
        get: endpoint => {
            return fetch(`${gradio_config.root}/statemanager/${endpoint}`).then(response => {
                if (response.ok) {
                    return response.json();
                }
                else {
                    return Promise.reject(response);
                }
            });
        },
        post: (endpoint, payload) => {
            return fetch(`${gradio_config.root}/statemanager/${endpoint}`, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': "application/json" }, body: JSON.stringify(payload) })
                .then(response => {
                if (response.ok) {
                    return response.json();
                }
                else {
                    return Promise.reject(response);
                }
            });
        }
    };
    // Shamelessly yoinked from https://www.syncfusion.com/blogs/post/deep-compare-javascript-objects.aspx
    sm.utils = {
        // UI
        getCurrentGenerationTypeFromUI: () => {
            if (uiCurrentTab.innerText == 'txt2img' || uiCurrentTab.innerText == 'img2img') {
                return uiCurrentTab.innerText;
            }
            // In case of i18n e.g., we fall back to this
            if (app.getElementById("tab_txt2img").style.display == 'block') {
                return 'txt2img';
            }
            else if (app.getElementById("tab_img2img").style.display == 'block') {
                return 'img2img';
            }
            return null;
        },
        areLooselyEqualValue: (...values) => {
            const qualifiesForLooseComparison = looselyEqualUIValues.has(values[0]);
            return values.reduce((isEqual, value) => isEqual && (value == values[0] || sm.utils.isDeepEqual(value, values[0]) || (qualifiesForLooseComparison && looselyEqualUIValues.has(value))), true);
        },
        // Objects
        isDeepEqual: (object1, object2) => {
            if (!object1 || !object2) {
                return false;
            }
            const objKeys1 = Object.keys(object1);
            const objKeys2 = Object.keys(object2);
            if (objKeys1.length !== objKeys2.length)
                return false;
            for (let key of objKeys1) {
                const value1 = object1[key];
                const value2 = object2[key];
                const isObjects = sm.utils.isObject(value1) && sm.utils.isObject(value2);
                if ((isObjects && !sm.utils.isDeepEqual(value1, value2)) || (!isObjects && value1 !== value2)) {
                    return false;
                }
            }
            return true;
        },
        isObject: object => {
            return object != null && typeof object === "object";
        },
        isEmptyObject: object => {
            return sm.utils.isObject(object) && Object.keys(object).length == 0;
        },
        isValidResponse: (response, ...requiredProperties) => {
            return response && !sm.utils.isEmptyObject(response) && requiredProperties.every(p => response.hasOwnProperty(p));
        },
        logResponseError: async function (baseMessage, e) {
            let err = "[No error received]";
            let errType = "unknown type";
            if (typeof e == 'string') {
                errType = "string";
                err = e;
            }
            else if (e instanceof Response) {
                errType = "Response object";
                err = await e.text();
            }
            else {
                err = e;
            }
            console.error(`${baseMessage}: (${errType} error) ${err}`);
        },
        getSettingPathInfo: function (settingPath) {
            const index = Number(settingPath.match(/\/(\d+)$/)?.[1] || 0);
            return {
                basePath: settingPath.replace(/\/\d+$/, ''),
                index: index,
            };
        },
        unflattenSettingsMap: function (settings) {
            const settingPaths = Object.keys(settings);
            let settingsMap = {};
            for (const path of settingPaths) {
                const pathParts = path.split('/');
                const sliceEnd = pathParts[pathParts.length - 1] == 'value' ? -1 : pathParts.length;
                if (pathParts[0] == 'customscript') { // customscript/seed.py/txt2img/Seed/value e.g.
                    settingsMap[pathParts[1]] = settingsMap[pathParts[1]] || {};
                    settingsMap[pathParts[1]][pathParts.slice(3, sliceEnd).join('/')] = settings[path];
                }
                else { // txt2img/prompt e.g.
                    settingsMap[pathParts[0]] = settingsMap[pathParts[0]] || {};
                    settingsMap[pathParts[0]][pathParts.slice(1, sliceEnd).join('/')] = settings[path];
                }
            }
            return settingsMap;
        },
        getFilteredObject: function (values, ...filter) {
            if (filter.length > 0) {
                values = Object.keys(values).reduce((newValues, path) => {
                    if (filter.indexOf(path) > -1) {
                        newValues[path] = values[path];
                    }
                    return newValues;
                }, {});
            }
            return values;
        },
        // GZIP compression https://evanhahn.com/javascript-compression-streams-api-with-strings/
        compress: async function (str) {
            const stream = new Blob([str]).stream();
            const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
            const chunks = [];
            // Not supported in anything other than FF yet
            // for await (const chunk of compressedStream) {
            //     chunks.push(chunk);
            // }
            const reader = compressedStream.getReader();
            await reader.read().then(function processChunk({ done, value }) {
                if (done) {
                    return;
                }
                chunks.push(value);
                return reader.read().then(processChunk);
            });
            return await sm.utils.concatUint8Arrays(chunks);
        },
        decompress: async function (compressedBytes) {
            const stream = new Blob([compressedBytes]).stream();
            const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
            const chunks = [];
            // Not supported in anything other than FF yet
            // for await (const chunk of decompressedStream) {
            //     chunks.push(chunk);
            // }
            const reader = decompressedStream.getReader();
            await reader.read().then(function processChunk({ done, value }) {
                if (done) {
                    return;
                }
                chunks.push(value);
                return reader.read().then(processChunk);
            });
            const stringBytes = await sm.utils.concatUint8Arrays(chunks);
            return new TextDecoder().decode(stringBytes);
        },
        concatUint8Arrays: async function (uint8arrays) {
            const blob = new Blob(uint8arrays);
            const buffer = await blob.arrayBuffer();
            return new Uint8Array(buffer);
        }
    };
    sm.init = async function () {
        const versionPromise = sm.api.get("version")
            .then(response => {
            if (!sm.utils.isValidResponse(response, 'version')) {
                Promise.reject(response);
            }
            sm.version = response.version;
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Getting State Manager version failed with error", e));
        const storagePromise = sm.getFromStorage()
            .then(async (storedData) => {
            await sm.initMemoryStorage(storedData);
            if (sm.hasOwnProperty('updateEntriesWhenStorageReady')) {
                sm.updateEntries();
            }
        })
            .catch(e => sm.utils.logResponseError("[State Manager] Could not get data from storage", e));
        // Build the component map in parallel; UI can render before this finishes.
        const componentMapPromise = sm.buildComponentMap();
        const forgeNeoSelectorsPromise = sm.fetchForgeNeoSelectors();
        await Promise.all([versionPromise, storagePromise]);
        sm.injectUI();
        await componentMapPromise;
        await forgeNeoSelectorsPromise;
        sm.applyStartupConfigIfEnabled?.();
    };
    onUiLoaded(sm.init);
    onAfterUiUpdate(sm.checkHeadImage);
})(window.stateManager = window.stateManager || {
    componentMap: {},
    forgeNeoSelectorMap: {},
    activeProfileDraft: null,
    activeProfileSaveButtons: [],
    memoryStorage: {
        currentDefault: null,
        savedDefaults: null,
        favouritesOrder: [],
        entries: {
            data: {},
            orderedKeys: [],
            updateKeys: () => { }
        }
    },
    selection: {
        rangeSelectStart: null,
        entries: [],
        selectedStateKeys: new Set(),
        undoableRangeSelectionAmount: 0,
        select: function (entry, type) {
            const getStateKey = (targetEntry) => `${targetEntry?.data?.createdAt ?? ''}`;
            const addStateKey = (targetEntry) => {
                const key = getStateKey(targetEntry);
                if (key.length > 0) {
                    this.selectedStateKeys.add(key);
                }
            };
            const deleteStateKey = (targetEntry) => {
                const key = getStateKey(targetEntry);
                if (key.length > 0) {
                    this.selectedStateKeys.delete(key);
                }
            };
            this.selectedStateKeys = this.selectedStateKeys || new Set();
            const currentSingleSelection = this.entries.length == 1 ? this.entries[0] : null;
            if (type == 'single' && currentSingleSelection && currentSingleSelection != entry) {
                if (!window.stateManager.confirmDiscardPendingProfileChanges()) {
                    return;
                }
            }
            switch (type) {
                case 'single':
                    for (let e of this.entries) {
                        e.classList.remove('active');
                    }
                    this.selectedStateKeys.clear();
                    addStateKey(entry);
                    this.rangeSelectStart = entry;
                    this.entries = [entry];
                    this.undoableRangeSelectionAmount = 0;
                    entry.classList.add('active');
                    break;
                case 'add':
                    this.rangeSelectStart = entry;
                    this.undoableRangeSelectionAmount = 0;
                    entry.classList.toggle('active');
                    if (entry.classList.contains('active')) {
                        if (this.entries.indexOf(entry) == -1) {
                            this.entries.push(entry);
                        }
                        addStateKey(entry);
                    }
                    else {
                        const entryIndex = this.entries.indexOf(entry);
                        if (entryIndex > -1) {
                            this.entries.splice(entryIndex, 1);
                        }
                        deleteStateKey(entry);
                    }
                    break;
                case 'range':
                    if (this.rangeSelectStart == null) {
                        this.select(entry, 'single');
                        return;
                    }
                    // unselect previous range select
                    const unselectedEntries = this.entries.splice(this.entries.length - this.undoableRangeSelectionAmount, this.undoableRangeSelectionAmount);
                    for (let i = 0; i < unselectedEntries.length; i++) {
                        unselectedEntries[i].classList.remove('active');
                        deleteStateKey(unselectedEntries[i]);
                    }
                    if (entry == this.rangeSelectStart) {
                        return;
                    }
                    // select new range
                    let rangeStartIndex = Array.prototype.indexOf.call(this.rangeSelectStart.parentNode.children, this.rangeSelectStart);
                    let rangeEndIndex = Array.prototype.indexOf.call(entry.parentNode.children, entry);
                    function selectEntry(index) {
                        const rangeEntry = entry.parentNode.childNodes[index];
                        this.entries.push(rangeEntry);
                        rangeEntry.classList.add('active');
                        addStateKey(rangeEntry);
                    }
                    if (rangeStartIndex < rangeEndIndex) {
                        for (let i = rangeStartIndex + 1; i <= rangeEndIndex; i++) {
                            selectEntry(i);
                        }
                        this.undoableRangeSelectionAmount = rangeEndIndex - rangeStartIndex; // - 1;    
                    }
                    else {
                        for (let i = rangeStartIndex - 1; i >= rangeEndIndex; i--) {
                            selectEntry(i);
                        }
                        this.undoableRangeSelectionAmount = rangeStartIndex - rangeEndIndex; // - 1;    
                    }
                    break;
            }
            window.stateManager.updateInspector();
            window.stateManager.syncConfigReorderControlsState?.();
        }
    }
});
