import { i18n } from "@lingui/core";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BrowseMountedDirectory from "../../src/snapshot-directory/components/BrowseMountedDirectory";
import { render } from "../testing-utils";

const runtime = vi.hoisted(() => ({ embedded: true }));
vi.mock("../../src/core/uiService", () => ({
  get isKopiaEmbedded() {
    return runtime.embedded;
  }
}));
beforeEach(() => i18n.activate("en"));
afterEach(() => {
  delete window.kopiaUI;
  runtime.embedded = true;
});

describe("browse mounted directory", () => {
  test("browser mode has no native browse button", () => {
    render(<BrowseMountedDirectory path="/mounted" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("multi-server mode does not browse a remote path locally", () => {
    runtime.embedded = false;
    window.kopiaUI = { browseDirectory: vi.fn() };
    render(<BrowseMountedDirectory path="/remote" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("passes the mounted Unicode Windows path directly to the preload bridge", async () => {
    const browseDirectory = vi.fn().mockResolvedValue("");
    window.kopiaUI = { browseDirectory };
    render(<BrowseMountedDirectory path={"D:\\挂载 & files"} />);
    fireEvent.click(screen.getByRole("button", { name: "Browse mounted directory" }));
    await waitFor(() => expect(browseDirectory).toHaveBeenCalledWith("D:\\挂载 & files"));
  });

  test.each(["message", "rejection"])("displays native %s failures", async (kind) => {
    window.kopiaUI = {
      browseDirectory:
        kind === "message"
          ? vi.fn().mockResolvedValue("Path not found")
          : vi.fn().mockRejectedValue(new Error("Path not found"))
    };
    render(<BrowseMountedDirectory path="/missing" />);
    fireEvent.click(screen.getByRole("button", { name: "Browse mounted directory" }));
    expect(await screen.findByText("Path not found")).toBeVisible();
  });
});
