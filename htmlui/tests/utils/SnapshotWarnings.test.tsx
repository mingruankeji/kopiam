import { i18n } from "@lingui/core";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import SnapshotWarnings from "../../src/core/SnapshotWarnings";
import type { DirectorySummary } from "../../src/core/types";
import { render } from "../testing-utils";

const summary: DirectorySummary = { size: 1, files: 1, dirs: 1, symlinks: 0, maxTime: "", numFailed: 0 };
beforeEach(() => i18n.activate("en"));

describe("snapshot warnings", () => {
  test("healthy summaries add no warning UI", () => {
    const { container } = render(<SnapshotWarnings summary={summary} />);
    expect(container.querySelector(".mantine-Alert-root")).toBeNull();
  });

  test("shows every failed path and error without truncating long Unicode details", () => {
    render(
      <SnapshotWarnings
        summary={{
          ...summary,
          numFailed: 3,
          failedEntries: [
            { path: "D:\\中文\\secret.txt", error: "Permission denied\nMore detail" },
            { path: "/another/file", error: "Input/output error" }
          ]
        }}
        incomplete="checkpoint"
      />
    );
    expect(screen.getByText("D:\\中文\\secret.txt")).toBeVisible();
    expect(screen.getByText("Permission denied More detail")).toBeVisible();
    expect(screen.getByText("/another/file")).toBeVisible();
    expect(screen.getByText("Input/output error")).toBeVisible();
    expect(screen.getByText(/checkpoint/)).toBeVisible();
    expect(screen.getByText("Additional failed entry details are not available.")).toBeVisible();
  });

  test("directory summary incomplete and ignored error counts are displayed", () => {
    render(<SnapshotWarnings summary={{ ...summary, incomplete: "canceled", ignoredErrorCount: 2 }} />);
    expect(screen.getByText(/canceled/)).toBeVisible();
    expect(screen.getByText(/Ignored errors/)).toHaveTextContent("2");
  });

  test("provided failure details remain visible even without a fatal count", () => {
    render(<SnapshotWarnings summary={{ ...summary, failedEntries: [{ path: "/file", error: "unreadable" }] }} />);
    expect(screen.getByText("unreadable")).toBeVisible();
  });
});
