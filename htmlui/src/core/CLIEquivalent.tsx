import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Group, Select, Stack, Text, Textarea } from "@mantine/core";
import { IconCopy, IconTerminal } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { type CommandShell, formatCLICommand, parseCLIExecutable } from "../utils/cliCommand";
import { useServerInstanceContext } from "./context/ServerInstanceContext";
import { ErrorAlert } from "./ErrorAlert/ErrorAlert";
import type { ErrorInformation } from "./hooks/useApiRequest";

type Props = {
  command: readonly string[];
};

export default function CLIEquivalent({ command }: Props) {
  const { kopiaService } = useServerInstanceContext();
  const [visible, setVisible] = useState(false);
  const [executable, setExecutable] = useState("");
  const [shell, setShell] = useState<CommandShell>("posix");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorInformation>();
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setExecutable("");
    setError(undefined);
    setCopied("");
    kopiaService.getCLIInfo().then(
      (response) => {
        if (!active) return;
        if (response.isError || !response.data?.executable) {
          setError({ title: t`Unable to load CLI information` });
        } else {
          try {
            const { path } = parseCLIExecutable(response.data.executable);
            setExecutable(response.data.executable);
            setShell(/^[A-Za-z]:\\|^\\\\/.test(path) ? "powershell" : "posix");
          } catch {
            setError({ title: t`Unable to load CLI information` });
          }
        }
        setLoading(false);
      },
      () => {
        if (!active) return;
        setLoading(false);
        setError({ title: t`Unable to load CLI information` });
      }
    );
    return () => {
      active = false;
    };
  }, [visible, kopiaService]);

  const value = executable ? formatCLICommand(executable, command, shell) : "";
  async function copy() {
    setError(undefined);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setCopied("");
      setError({ title: t`Unable to copy command`, message: t`Select and copy the command manually.` });
    }
  }

  return (
    <Stack gap="xs">
      <Group>
        <Button
          size="xs"
          variant="subtle"
          leftSection={<IconTerminal size={16} />}
          onClick={() => setVisible(!visible)}
          aria-expanded={visible}
        >
          <Trans>CLI equivalent</Trans>
        </Button>
        {visible && (
          <Button size="xs" leftSection={<IconCopy size={16} />} onClick={copy} disabled={!value} loading={loading}>
            {copied && copied === value ? <Trans>Copied</Trans> : <Trans>Copy command</Trans>}
          </Button>
        )}
      </Group>
      {visible && (
        <>
          <Select
            label={t`Command shell`}
            value={shell}
            data={[
              { value: "posix", label: t`POSIX shell` },
              { value: "powershell", label: t`PowerShell (Windows)` }
            ]}
            onChange={(value) => {
              setShell(value as CommandShell);
              setCopied("");
            }}
            allowDeselect={false}
          />
          <Textarea
            label={t`Command`}
            value={value}
            readOnly
            autosize
            styles={{ input: { fontFamily: "monospace" } }}
          />
          <Text size="xs" c="dimmed">
            <Trans>Run this command on the Kopia server with access to its repository configuration.</Trans>
          </Text>
          <ErrorAlert error={error} />
        </>
      )}
    </Stack>
  );
}
