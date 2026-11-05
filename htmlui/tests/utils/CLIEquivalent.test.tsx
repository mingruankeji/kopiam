import { i18n } from "@lingui/core";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import CLIEquivalent from "../../src/core/CLIEquivalent";
import { render } from "../testing-utils";

const service = vi.hoisted(() => ({ getCLIInfo: vi.fn() }));
vi.mock("../../src/core/context/ServerInstanceContext", () => ({
  useServerInstanceContext: () => ({ kopiaService: service })
}));

beforeEach(() => {
  i18n.activate("en");
  Object.defineProperty(document, "fonts", { configurable: true, value: new EventTarget() });
  service.getCLIInfo.mockReset().mockResolvedValue({
    isError: false,
    data: { executable: '"/opt/Kopia App/kopia" --config-file="/config/repository.config"' }
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) }
  });
});

describe("CLI equivalent", () => {
  test("loads lazily and copies exactly the displayed credential-free command", async () => {
    render(<CLIEquivalent command={["snapshot", "list"]} />);
    expect(service.getCLIInfo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "CLI equivalent" }));
    const command = screen.getByRole("textbox", { name: "Command" });
    await waitFor(() =>
      expect(command).toHaveValue("'/opt/Kopia App/kopia' '--config-file=/config/repository.config' 'snapshot' 'list'")
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith((command as HTMLTextAreaElement).value)
    );
    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    expect(service.getCLIInfo).toHaveBeenCalledTimes(1);
  });

  test("Windows server paths select PowerShell regardless of browser platform", async () => {
    service.getCLIInfo.mockResolvedValue({
      isError: false,
      data: { executable: '"C:\\Program Files\\kopia.exe" --config-file=D:\\repo.config' }
    });
    render(<CLIEquivalent command={["repository", "status"]} />);
    fireEvent.click(screen.getByRole("button", { name: "CLI equivalent" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Command" })).toHaveValue(
        "& 'C:\\Program Files\\kopia.exe' '--config-file=D:\\repo.config' 'repository' 'status'"
      )
    );
  });

  test.each(["api", "rejection", "invalid"])(
    "%s failures expose an error and never offer an undefined executable",
    async (kind) => {
      if (kind === "rejection") {
        service.getCLIInfo.mockRejectedValue(new Error("Network failure"));
      } else {
        service.getCLIInfo.mockResolvedValue(
          kind === "invalid"
            ? { isError: false, data: { executable: "invalid" } }
            : { isError: true, responseCode: 403 }
        );
      }
      render(<CLIEquivalent command={["policy", "list"]} />);
      fireEvent.click(screen.getByRole("button", { name: "CLI equivalent" }));
      expect(await screen.findByText("Unable to load CLI information")).toBeVisible();
      expect(screen.getByRole("button", { name: "Copy command" })).toBeDisabled();
    }
  );

  test("updates the command when the history filter changes", async () => {
    const { rerender } = render(<CLIEquivalent command={["snapshot", "list"]} />);
    fireEvent.click(screen.getByRole("button", { name: "CLI equivalent" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy command" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    rerender(
      <>
        <CLIEquivalent command={["snapshot", "list", "--show-identical"]} />
      </>
    );
    expect(screen.getByRole("textbox", { name: "Command" })).toHaveValue(
      "'/opt/Kopia App/kopia' '--config-file=/config/repository.config' 'snapshot' 'list' '--show-identical'"
    );
    expect(screen.getByRole("button", { name: "Copy command" })).toBeEnabled();
    expect(service.getCLIInfo).toHaveBeenCalledTimes(1);
  });

  test("clipboard failures remain explicit and command remains manually selectable", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    render(<CLIEquivalent command={["list", "k123"]} />);
    fireEvent.click(screen.getByRole("button", { name: "CLI equivalent" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy command" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
    expect(await screen.findByText("Unable to copy command")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Command" })).toHaveAttribute("readonly");
  });
});
