import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import LocalPathInput from "../../src/core/LocalPathInput";
import { render } from "../testing-utils";

const runtime = vi.hoisted(() => ({ embedded: true }));
vi.mock("../../src/core/uiService", () => ({
  get isKopiaEmbedded() {
    return runtime.embedded;
  }
}));

afterEach(() => {
  delete window.kopiaUI;
  runtime.embedded = true;
  vi.restoreAllMocks();
});

describe("Electron path input", () => {
  test("passes the initial path and applies the selected Unicode directory", async () => {
    const selectPath = vi.fn().mockResolvedValue("D:\\中文\\备份");
    const onPathSelected = vi.fn();
    window.kopiaUI = { selectPath };
    render(
      <LocalPathInput
        label="路径"
        pathKind="directory"
        value={"D:\\原目录"}
        onChange={vi.fn()}
        onPathSelected={onPathSelected}
      />
    );
    expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("textbox"));
    await waitFor(() => expect(onPathSelected).toHaveBeenCalledWith("D:\\中文\\备份"));
    expect(selectPath).toHaveBeenCalledWith({ kind: "directory", defaultPath: "D:\\原目录", extension: undefined });
  });

  test.each(["zip", "tar"] as const)("uses save-file for %s restore", async (extension) => {
    const selectPath = vi.fn().mockResolvedValue(`D:\\恢复.${extension}`);
    const onPathSelected = vi.fn();
    window.kopiaUI = { selectPath };
    render(<LocalPathInput pathKind="save-file" extension={extension} onPathSelected={onPathSelected} />);
    fireEvent.click(screen.getByRole("button", { name: "保存文件" }));
    await waitFor(() => expect(onPathSelected).toHaveBeenCalledWith(`D:\\恢复.${extension}`));
    expect(selectPath).toHaveBeenCalledWith({ kind: "save-file", defaultPath: undefined, extension });
  });

  test("uses open-file for credentials and executables", async () => {
    const selectPath = vi.fn().mockResolvedValue("D:\\凭据.json");
    window.kopiaUI = { selectPath };
    render(<LocalPathInput pathKind="file" onPathSelected={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "选择文件" }));
    await waitFor(() =>
      expect(selectPath).toHaveBeenCalledWith({ kind: "file", defaultPath: undefined, extension: undefined })
    );
  });

  test("cancellation preserves the original path", async () => {
    const selectPath = vi.fn().mockResolvedValue(null);
    const onPathSelected = vi.fn();
    window.kopiaUI = { selectPath };
    render(
      <LocalPathInput pathKind="directory" value={"D:\\原目录"} onChange={vi.fn()} onPathSelected={onPathSelected} />
    );
    fireEvent.click(screen.getByRole("button", { name: "选择目录" }));
    await waitFor(() => expect(screen.getByRole("button")).not.toHaveAttribute("data-loading"));
    expect(onPathSelected).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("D:\\原目录");
  });

  test("optional desktop paths can still be cleared with keyboard editing", () => {
    window.kopiaUI = { selectPath: vi.fn() };
    const onChange = vi.fn();
    render(<LocalPathInput pathKind="file" value={"D:\\凭据.json"} onChange={onChange} onPathSelected={vi.fn()} />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalled();
    expect(window.kopiaUI.selectPath).not.toHaveBeenCalled();
  });

  test("native failures are displayed instead of silently ignored", async () => {
    const selectPath = vi.fn().mockRejectedValue(new Error("无法打开文件对话框"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.kopiaUI = { selectPath };
    render(<LocalPathInput pathKind="directory" onPathSelected={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "选择目录" }));
    expect(await screen.findByText("无法打开文件对话框")).toBeVisible();
  });

  test.each([true, false])("browser input stays editable without a bridge (embedded=%s)", (embedded) => {
    runtime.embedded = embedded;
    const onChange = vi.fn();
    render(<LocalPathInput pathKind="directory" onChange={onChange} onPathSelected={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "/server/path" } });
    expect(onChange).toHaveBeenCalled();
  });

  test("multi-server mode does not select paths on the Electron host", () => {
    runtime.embedded = false;
    window.kopiaUI = { selectPath: vi.fn() };
    render(<LocalPathInput pathKind="directory" onPathSelected={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("disabled inputs cannot open native dialogs", () => {
    window.kopiaUI = { selectPath: vi.fn() };
    render(<LocalPathInput pathKind="file" disabled onPathSelected={vi.fn()} />);
    expect(screen.getByRole("button", { name: "选择文件" })).toBeDisabled();
    fireEvent.click(screen.getByRole("textbox"));
    expect(window.kopiaUI.selectPath).not.toHaveBeenCalled();
  });
});
