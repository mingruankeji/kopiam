import "@testing-library/jest-dom/vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { LogEntry, Task } from "../../../src/core/types";
import TaskLogs from "../../../src/tasks/components/TaskLogs";
import { render } from "../../testing-utils";

const api = vi.hoisted(() => ({ getTaskLogs: vi.fn() }));
vi.mock("../../../src/core/context/ServerInstanceContext", () => ({
  useServerInstanceContext: () => ({ kopiaService: api })
}));

const task: Task = {
  id: "task-1",
  kind: "Snapshot",
  description: "D:\\backup",
  status: "SUCCESS",
  startTime: new Date().toISOString(),
  progressInfo: "",
  counters: { "Excluded Bytes": { value: 0, units: "bytes", level: "" } }
};
const entry = (msg: string, level = 1, ts = 1): LogEntry => ({ msg, level, ts, mod: "snapshot" });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("Task logs", () => {
  test("keeps exactly the latest 100 non-errors and every error in order with full details", async () => {
    const detail = `first line\n${"long-error-detail".repeat(500)}\nlast line`;
    const logs = Array.from({ length: 250 }, (_, index) => entry(`success-${index}`, 1, index));
    logs.splice(1, 0, { ...entry(detail, 3, 0.5), error: detail, path: "D:\\中文\\file" });
    logs.push(...Array.from({ length: 150 }, (_, index) => entry(`error-${index}`, 3, index + 300)));
    api.getTaskLogs.mockResolvedValue({ isError: false, responseCode: 200, data: { logs } });
    render(<TaskLogs task={task} />);
    await screen.findByText(/success-249/);
    expect(screen.queryByText(/success-149/)).toBeNull();
    expect(screen.getAllByText(/success-\d+/)).toHaveLength(100);
    expect(screen.getAllByText(/\] error-\d+/)).toHaveLength(150);
    const fullError = screen.getByText(
      (_, element) => element?.tagName === "P" && element.textContent?.includes("first line") === true
    );
    expect(fullError.textContent).toContain(detail);
    expect(fullError.textContent).toContain('"path": "D:\\\\中文\\\\file"');
    expect(fullError).toHaveStyle({ whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
  });

  test("handles an empty backend log buffer and exposes request failures", async () => {
    api.getTaskLogs.mockResolvedValueOnce({ isError: false, responseCode: 200, data: { logs: null } });
    const view = render(<TaskLogs task={task} />);
    await screen.findByText("暂无可显示的日志");
    api.getTaskLogs.mockResolvedValueOnce({
      isError: true,
      responseCode: 500,
      data: { code: "LOG_ERROR", error: "日志加载失败" }
    });
    view.rerender(<TaskLogs task={{ ...task, id: "task-2" }} />);
    expect(await screen.findByText("日志加载失败")).toBeVisible();
  });

  test("searches full structured error details", async () => {
    api.getTaskLogs.mockResolvedValue({
      isError: false,
      responseCode: 200,
      data: {
        logs: [entry("ok"), { ...entry("failed", 3), error: "nested permission denied" }]
      }
    });
    render(<TaskLogs task={task} />);
    await screen.findByText(/nested permission denied/);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "PERMISSION" } });
    expect(screen.queryByText(/\] ok/)).toBeNull();
    expect(screen.getByText(/nested permission denied/)).toBeVisible();
  });

  test("refreshes running and canceling tasks and fetches final logs on completion", async () => {
    vi.useFakeTimers();
    api.getTaskLogs.mockResolvedValue({ isError: false, responseCode: 200, data: { logs: [entry("initial")] } });
    const view = render(<TaskLogs task={{ ...task, status: "RUNNING" }} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/initial/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(api.getTaskLogs).toHaveBeenCalledTimes(2);
    await act(async () => {
      view.rerender(<TaskLogs task={{ ...task, status: "CANCELING" }} />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(api.getTaskLogs).toHaveBeenCalledTimes(4);
    api.getTaskLogs.mockResolvedValue({ isError: false, responseCode: 200, data: { logs: [entry("final error", 3)] } });
    await act(async () => {
      view.rerender(<TaskLogs task={task} />);
    });
    expect(screen.getByText(/final error/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(api.getTaskLogs).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
    await waitFor(() => expect(api.getTaskLogs).toHaveBeenLastCalledWith("task-1"));
  });
});
