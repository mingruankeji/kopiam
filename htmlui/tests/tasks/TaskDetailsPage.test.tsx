import "@testing-library/jest-dom/vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Task } from "../../src/core/types";
import TaskDetailsPage from "../../src/tasks/TaskDetailsPage";
import { render } from "../testing-utils";

const api = vi.hoisted(() => ({ getTask: vi.fn(), cancelTask: vi.fn() }));
vi.mock("../../src/core/context/ServerInstanceContext", () => ({
  useServerInstanceContext: () => ({ kopiaService: api })
}));
vi.mock("../../src/tasks/components/TaskLogs", () => ({ default: () => <div>Task logs</div> }));
vi.mock("../../src/tasks/components/TaskCounterGrid", () => ({ default: () => null }));

const task: Task = {
  id: "task-1",
  kind: "Snapshot",
  status: "RUNNING",
  description: "D:\\backup",
  startTime: new Date().toISOString(),
  progressInfo: "currently uploading",
  counters: { "Excluded Bytes": { value: 0, units: "bytes", level: "" } }
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getTask.mockResolvedValue({ isError: false, responseCode: 200, data: task });
  api.cancelTask.mockResolvedValue({ isError: false, responseCode: 200, data: {} });
});
afterEach(() => vi.useRealTimers());

describe("Task details", () => {
  test("shows progress, cancels the exact task, and keeps polling while canceling", async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <TaskDetailsPage taskId={task.id} />
      </MemoryRouter>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("currently uploading")).toBeVisible();
    api.getTask.mockResolvedValue({ isError: false, responseCode: 200, data: { ...task, status: "CANCELING" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "停止任务" }));
    });
    expect(api.cancelTask).toHaveBeenCalledWith(task.id);
    expect(api.getTask).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "停止任务" })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(api.getTask).toHaveBeenCalledTimes(3);
    api.getTask.mockResolvedValue({
      isError: false,
      responseCode: 200,
      data: { ...task, status: "CANCELED", endTime: new Date().toISOString() }
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(api.getTask).toHaveBeenCalledTimes(4);
  });

  test("keeps multiline task errors complete and fetches a different task on navigation", async () => {
    const errorMessage = `first line\n${"detail ".repeat(500)}\nlast line`;
    api.getTask.mockResolvedValue({
      isError: false,
      responseCode: 200,
      data: {
        ...task,
        status: "FAILED",
        endTime: new Date().toISOString(),
        errorMessage
      }
    });
    const view = render(
      <MemoryRouter>
        <TaskDetailsPage taskId={task.id} />
      </MemoryRouter>
    );
    const error = await screen.findByText(/first line/);
    expect(error.textContent).toBe(errorMessage);
    expect(error).toHaveStyle({ whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
    view.rerender(
      <MemoryRouter>
        <TaskDetailsPage taskId="task-2" />
      </MemoryRouter>
    );
    await waitFor(() => expect(api.getTask).toHaveBeenLastCalledWith("task-2"));
  });
});
