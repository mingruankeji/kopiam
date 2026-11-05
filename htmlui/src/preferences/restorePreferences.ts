import type { RestorePreferences } from "../core/types";

export const defaultRestorePreferences: RestorePreferences = {
  type: "directory",
  incremental: true,
  continueOnErrors: false,
  restoreOwnership: true,
  restorePermissions: true,
  restoreModTimes: true,
  uncompressedZip: true,
  overwriteFiles: false,
  overwriteDirectories: false,
  overwriteSymlinks: false,
  ignorePermissionErrors: true,
  writeFilesAtomically: false,
  writeSparseFiles: false,
  restoreDirEntryAtDepth: 1000,
  minSizeForPlaceholder: 0
};
