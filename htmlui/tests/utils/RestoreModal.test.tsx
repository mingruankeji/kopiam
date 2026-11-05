import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { RestorePreferences } from "../../src/core/types";
import RestoreSection from "../../src/preferences/RestoreSection";
import { defaultRestorePreferences } from "../../src/preferences/restorePreferences";
import RestoreModal from "../../src/snapshot-directory/modals/RestoreModal";
import { render } from "../testing-utils";

const service = vi.hoisted(() => ({
  restore: vi.fn(),
  getPreferences: vi.fn(),
  setPreferences: vi.fn(),
  reloadPreferences: vi.fn(),
  preferences: undefined as RestorePreferences | undefined
}));
vi.mock("../../src/core/context/ServerInstanceContext", () => ({
  useServerInstanceContext: () => ({ kopiaService: service })
}));
vi.mock("../../src/core/context/AppContext", () => ({
  useAppContext: () => ({ restore: service.preferences, reloadPreferences: service.reloadPreferences })
}));
vi.mock("@mantine/notifications", () => ({ showNotification: vi.fn() }));

const task = { id: "restore-task" };
const destination = "C:\\恢复目录";

beforeEach(() => {
  vi.clearAllMocks();
  service.preferences = undefined;
  service.restore.mockResolvedValue({ isError: false, responseCode: 200, data: task });
  service.getPreferences.mockResolvedValue({
    isError: false,
    responseCode: 200,
    data: { theme: "dark", locale: "zh", pageSize: 40 }
  });
  service.setPreferences.mockResolvedValue({ isError: false, responseCode: 200, data: {} });
});

function openRestore() {
  const onCancel = vi.fn();
  const onRestoreStarted = vi.fn();
  const result = render(<RestoreModal oid="root" onCancel={onCancel} onRestoreStarted={onRestoreStarted} />);
  fireEvent.change(screen.getByRole("textbox", { name: "目标位置" }), { target: { value: destination } });
  return { ...result, onCancel, onRestoreStarted };
}

test("restore dialog uses saved defaults without showing option switches", async () => {
  service.preferences = { ...defaultRestorePreferences, restoreOwnership: false, restoreDirEntryAtDepth: 0 };
  const { onRestoreStarted } = openRestore();
  expect(screen.queryAllByRole("switch")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "开始恢复" }));
  await waitFor(() => expect(onRestoreStarted).toHaveBeenCalledWith(task));
  expect(service.restore).toHaveBeenCalledWith(
    expect.objectContaining({
      checkForConflicts: true,
      options: expect.objectContaining({ incremental: true, restoreDirEntryAtDepth: 0 }),
      fsOutput: expect.objectContaining({ targetPath: destination, skipOwners: true, overwriteFiles: false })
    })
  );
});

test.each([false, true])("conflicts require confirmation with overwrite defaults=%s", async (overwrite) => {
  service.preferences = {
    ...defaultRestorePreferences,
    overwriteFiles: overwrite,
    overwriteDirectories: overwrite
  };
  service.restore.mockResolvedValueOnce({
    isError: true,
    responseCode: 409,
    data: { code: "RESTORE_CONFLICT", error: destination }
  });
  const { onRestoreStarted } = openRestore();
  fireEvent.click(screen.getByRole("button", { name: "开始恢复" }));
  const replace = await screen.findByRole("button", { name: "全部替换" });
  expect(onRestoreStarted).not.toHaveBeenCalled();
  expect(service.restore).toHaveBeenCalledTimes(1);
  fireEvent.click(replace);
  await waitFor(() => expect(onRestoreStarted).toHaveBeenCalledWith(task));
  expect(service.restore).toHaveBeenLastCalledWith(
    expect.objectContaining({
      checkForConflicts: true,
      overwriteConfirmed: true
    })
  );
});

test("cancel after conflict does not send a restore confirmation", async () => {
  service.restore.mockResolvedValueOnce({
    isError: true,
    responseCode: 409,
    data: { code: "RESTORE_CONFLICT", error: destination }
  });
  const { onCancel, onRestoreStarted } = openRestore();
  fireEvent.click(screen.getByRole("button", { name: "开始恢复" }));
  await screen.findByRole("button", { name: "全部替换" });
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(service.restore).toHaveBeenCalledOnce();
  expect(onRestoreStarted).not.toHaveBeenCalled();
});

test.each(["zip", "tar"] as const)("saved %s format also confirms existing output files", async (type) => {
  service.preferences = { ...defaultRestorePreferences, type };
  service.restore.mockResolvedValueOnce({
    isError: true,
    responseCode: 409,
    data: { code: "RESTORE_CONFLICT", error: destination }
  });
  openRestore();
  fireEvent.click(screen.getByRole("button", { name: "开始恢复" }));
  await screen.findByRole("button", { name: "全部替换" });
  expect(service.restore).toHaveBeenCalledWith(
    expect.objectContaining({
      [type === "zip" ? "zipFile" : "tarFile"]: destination,
      checkForConflicts: true
    })
  );
});

test("other restore errors stay visible instead of asking for overwrite", async () => {
  service.restore.mockResolvedValueOnce({
    isError: true,
    responseCode: 500,
    data: { code: "INTERNAL", error: "access denied" }
  });
  const { onRestoreStarted } = openRestore();
  fireEvent.click(screen.getByRole("button", { name: "开始恢复" }));
  expect(await screen.findByText("access denied")).toBeVisible();
  expect(screen.queryByRole("button", { name: "全部替换" })).not.toBeInTheDocument();
  expect(onRestoreStarted).not.toHaveBeenCalled();
});

test("restore preferences save all defaults and preserve unrelated preferences", async () => {
  const view = render(<RestoreSection />);
  const owners = await screen.findByRole("switch", { name: "恢复文件所有权" });
  fireEvent.click(owners);
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(service.setPreferences).toHaveBeenCalledOnce());
  expect(service.setPreferences).toHaveBeenCalledWith({
    theme: "dark",
    locale: "zh",
    pageSize: 40,
    restore: { ...defaultRestorePreferences, restoreOwnership: false }
  });
  await waitFor(() => expect(service.reloadPreferences).toHaveBeenCalledOnce());
  service.preferences = service.setPreferences.mock.calls[0][0].restore;
  view.unmount();
  const { onRestoreStarted } = openRestore();
  fireEvent.click(screen.getByRole("button", { name: "开始恢复" }));
  await waitFor(() => expect(onRestoreStarted).toHaveBeenCalledWith(task));
  expect(service.restore).toHaveBeenCalledWith(
    expect.objectContaining({
      fsOutput: expect.objectContaining({ skipOwners: true })
    })
  );
});
