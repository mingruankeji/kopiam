import { describe, expect, test } from "vitest";
import {
  formatCLICommand,
  parseCLIExecutable,
  policyShowCommand,
  quoteShellArgument,
  snapshotHistoryCommand
} from "../../src/utils/cliCommand";

describe("CLI commands", () => {
  test("quotes every POSIX argument without expanding shell syntax", () => {
    const command = formatCLICommand(
      '"/opt/Kopia App/kopia" --config-file="/home/u/a b.config"',
      ["list", "/it's/$HOME;`echo injected`\\中文"],
      "posix"
    );
    expect(command).toBe(
      "'/opt/Kopia App/kopia' '--config-file=/home/u/a b.config' 'list' '/it'\\''s/$HOME;`echo injected`\\中文'"
    );
  });

  test("PowerShell preserves Windows paths, apostrophes and trailing backslashes", () => {
    expect(
      formatCLICommand(
        '"C:\\Program Files\\Kopia\\kopia.exe" --config-file="D:\\配置 文件.config"',
        ["list", "D:\\O'Brien\\$backup & files\\"],
        "powershell"
      )
    ).toBe(
      "& 'C:\\Program Files\\Kopia\\kopia.exe' '--config-file=D:\\配置 文件.config' 'list' 'D:\\O''Brien\\$backup & files\\'"
    );
    expect(quoteShellArgument("", "powershell")).toBe("''");
  });

  test("parses the API prefix as paths, not executable shell code", () => {
    expect(parseCLIExecutable("/opt/$(bad)/kopia --config-file=/a;bad")).toEqual({
      path: "/opt/$(bad)/kopia",
      configFile: "/a;bad"
    });
    expect(() => parseCLIExecutable("kopia")).toThrow("Invalid CLI information");
  });

  test("history uses the exact owner and supports identical and incomplete snapshots", () => {
    const source = { userName: "user", host: "host", path: "D:\\中文 & files" };
    expect(snapshotHistoryCommand(source, false)).toEqual([
      "snapshot",
      "list",
      "--incomplete",
      "user@host:D:\\中文 & files"
    ]);
    expect(snapshotHistoryCommand(source, true)).toContain("--show-identical");
  });

  test("policy viewing uses current CLI global, host, user and path targets", () => {
    expect(policyShowCommand({ host: "", userName: "", path: "" })).toEqual(["policy", "show", "--global"]);
    expect(policyShowCommand({ host: "server", userName: "", path: "" })).toEqual(["policy", "show", "@server"]);
    expect(policyShowCommand({ host: "server", userName: "user", path: "" })).toEqual([
      "policy",
      "show",
      "user@server"
    ]);
    expect(policyShowCommand({ host: "server", userName: "user", path: "/files" })).toEqual([
      "policy",
      "show",
      "user@server:/files"
    ]);
  });
});
