# Regression checks

Run from the repository root with Node.js and Python on PATH:

```sh
node --test tests/compatibility.test.cjs
```

The suite runs the shipped JavaScript and loads the Python selector registry. It
checks capture/apply aliases, nested DOM inputs, gzip storage formats, write
completion and failures, named saves, startup ordering and automatic history.
It also covers per-field application results, concurrent applications, one-level
Undo and retry, UI value comparisons, portable defaults, schema validation,
fresh import identities and rollback on persistence failure.
The DOM, Gradio components and extension API use controlled fixtures. This does
not replace a save/restore check inside Forge Neo.

Generate the runtime from TypeScript:

```sh
npx --package typescript@5.9.3 tsc -p tsconfig.json --noCheck
node --check javascript/statemanager.js
```

The project has pre-existing type errors. `--noCheck` emits JavaScript without
full type checking; use `tsc -p tsconfig.json --noEmit` to inspect those errors.
Always regenerate the JavaScript after changing `statemanager.ts`.

Optional browser smoke check with Playwright installed and Microsoft Edge available:

```sh
node tests/browser-smoke.cjs
```

Set `STATE_MANAGER_PLAYWRIGHT` to an existing Playwright module directory if it is
not installed locally. Set `STATE_MANAGER_SCREENSHOT` to an output path to inspect
the final view. The fixture mounts the real extension UI, exercises downloads,
import preview/cancel/Enter, Undo, and real browser IndexedDB at wide/narrow sizes
and in the modal. Forge APIs and component metadata are simulated.
