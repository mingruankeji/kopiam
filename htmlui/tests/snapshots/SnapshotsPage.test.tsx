import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SourceStatus, Sources } from "../../src/core/types";
import SnapshotsPage from "../../src/snapshots/SnapshotsPage";
import { render } from "../testing-utils";

const api = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  cancelSnapshot: vi.fn(),
  setPreferences: vi.fn(),
  reloadPreferences: vi.fn()
}));
vi.mock("../../src/core/context/ServerInstanceContext", () => ({
  useServerInstanceContext: () => ({ kopiaService: api })
}));
vi.mock("../../src/core/context/AppContext", () => ({
  useAppContext: () => ({
    pageSize: 20,
    bytesStringBase2: true,
    locale: "zh",
    defaultSnapshotViewAll: false,
    fontSize: "fs-6",
    language: "",
    theme: "light",
    reloadPreferences: api.reloadPreferences
  })
}));
vi.mock("../../src/core/DataGrid/DataGrid", () => ({
  DataGrid: ({
    records,
    columns
  }: {
    records: SourceStatus[];
    columns: { accessor: string; render?: (item: SourceStatus) => React.ReactNode }[];
  }) => (
    <div>
      {records.map((item) => (
        <div key={item.source.path}>
          <span>{item.source.path}</span>
          {columns.find((column) => column.accessor === "")?.render?.(item)}
        </div>
      ))}
    </div>
  )
}));
vi.mock("../../src/tasks/TaskDetailsPage", () => ({
  default: ({ taskId }: { taskId: string }) => <div>Task details: {taskId}</div>
}));

const source = { userName: "user", host: "host", path: "D:\\中文\\备份" };
const sources: Sources = {
  localUsername: "user",
  localHost: "host",
  multiUser: true,
  sources: [
    { source, status: "UPLOADING", schedule: {}, currentTask: "snapshot-1" },
    { source: { userName: "remote", host: "other", path: "remote-backup" }, status: "REMOTE", schedule: {} }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getSnapshots.mockResolvedValue({ isError: false, responseCode: 200, data: sources });
  api.cancelSnapshot.mockResolvedValue({ isError: false, responseCode: 200, data: {} });
  api.setPreferences.mockResolvedValue({ isError: false, responseCode: 200, data: {} });
});

describe("Snapshot page parity", () => {
  test("offers snapshot log history and opens live task details without leaving the page", async () => {
    render(
      <MemoryRouter>
        <SnapshotsPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "快照日志" })).toHaveAttribute("href", "/tasks?kind=Snapshot");
    fireEvent.click(await screen.findByRole("button", { name: "日志" }));
    expect(await screen.findByText("Task details: snapshot-1")).toBeVisible();
  });

  test("cancels the selected uploading source and refreshes the table", async () => {
    render(
      <MemoryRouter>
        <SnapshotsPage />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole("button", { name: "取消快照" }));
    await waitFor(() => expect(api.cancelSnapshot).toHaveBeenCalledWith(source));
    await waitFor(() => expect(api.getSnapshots).toHaveBeenCalledTimes(2));
  });

  test("applies the saved local-only preference and persists all-source selection", async () => {
    render(
      <MemoryRouter>
        <SnapshotsPage />
      </MemoryRouter>
    );
    await screen.findByText(source.path);
    expect(screen.queryByText("remote-backup")).toBeNull();
    const ownerButton = screen.getAllByRole("button").find((button) => button.textContent?.includes("本地快照"));
    expect(ownerButton).toBeDefined();
    fireEvent.click(ownerButton!);
    fireEvent.click(await screen.findByRole("menuitem", { name: "全部快照" }));
    await screen.findByText("remote-backup");
    await waitFor(() =>
      expect(api.setPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultSnapshotViewAll: true,
          bytesStringBase2: true,
          locale: "zh",
          pageSize: 20
        })
      )
    );
    expect(api.reloadPreferences).toHaveBeenCalledOnce();
  });
});
