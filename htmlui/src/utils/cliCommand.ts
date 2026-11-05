import type { SourceInfo } from "../core/types";

export type CommandShell = "posix" | "powershell";

export function quoteShellArgument(value: string, shell: CommandShell): string {
  return shell === "powershell" ? `'${value.replaceAll("'", "''")}'` : `'${value.replaceAll("'", "'\\''")}'`;
}

// The CLI endpoint returns two preformatted paths, not an argv array.
export function parseCLIExecutable(executable: string): { path: string; configFile: string } {
  const separator = " --config-file=";
  const index = executable.indexOf(separator);
  if (index < 1) throw new Error("Invalid CLI information");
  const unwrap = (value: string) => (value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value);
  return {
    path: unwrap(executable.slice(0, index)),
    configFile: unwrap(executable.slice(index + separator.length))
  };
}

export function formatCLICommand(executable: string, command: readonly string[], shell: CommandShell): string {
  const { path, configFile } = parseCLIExecutable(executable);
  const args = [path, `--config-file=${configFile}`, ...command].map((arg) => quoteShellArgument(arg, shell));
  return `${shell === "powershell" ? "& " : ""}${args.join(" ")}`;
}

export function snapshotHistoryCommand(source: SourceInfo, showAll: boolean): string[] {
  return [
    "snapshot",
    "list",
    "--incomplete",
    ...(showAll ? ["--show-identical"] : []),
    `${source.userName}@${source.host}:${source.path}`
  ];
}

export function policyShowCommand(target: SourceInfo): string[] {
  if (!target.host && !target.userName && !target.path) return ["policy", "show", "--global"];
  const owner = `${target.userName}@${target.host}`;
  return ["policy", "show", target.path ? `${owner}:${target.path}` : owner];
}
