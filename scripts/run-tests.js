// Runs the compiled test suite under Electron's own Node runtime
// (ELECTRON_RUN_AS_NODE=1) instead of the host Node install. Native modules
// like better-sqlite3 are ABI-specific to whichever Node build they were
// compiled against — this project always rebuilds them for Electron's ABI
// (see @electron/rebuild in devDependencies), so tests need to run under
// that same ABI rather than the host Node's, or the native addon fails to
// load with an ERR_DLOPEN_FAILED version mismatch.
const { spawnSync } = require("child_process");

const electronBinaryPath = require("electron");

const result = spawnSync(electronBinaryPath, ["--test", "dist"], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
});

process.exit(result.status ?? 1);
