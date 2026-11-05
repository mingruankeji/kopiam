import { t } from "@lingui/core/macro";
import { ActionIcon, Group, Stack, TextInput, type TextInputProps, Tooltip } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import { useState } from "react";
import { ErrorAlert } from "./ErrorAlert/ErrorAlert";
import type { ErrorInformation } from "./hooks/useApiRequest";
import { isKopiaEmbedded, type PathSelectionOptions } from "./uiService";

export type { PathSelectionOptions } from "./uiService";

type Props = TextInputProps & {
  pathKind: PathSelectionOptions["kind"];
  extension?: PathSelectionOptions["extension"];
  onPathSelected: (path: string) => void;
};

export default function LocalPathInput({ pathKind, extension, onPathSelected, ...inputProps }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorInformation>();
  const bridge = isKopiaEmbedded && typeof window.kopiaUI?.selectPath === "function" ? window.kopiaUI : undefined;
  const label = pathKind === "directory" ? t`Select directory` : pathKind === "file" ? t`Select file` : t`Save file`;

  async function selectPath() {
    if (!bridge?.selectPath || loading || inputProps.disabled || inputProps.readOnly) {
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const path = await bridge.selectPath({
        kind: pathKind,
        extension,
        defaultPath: typeof inputProps.value === "string" ? inputProps.value : undefined
      });
      if (path !== null) {
        onPathSelected(path);
      }
    } catch (error: unknown) {
      console.error(error);
      setError({
        title: t`Operation failed`,
        message: error instanceof Error ? error.message : t`Failed due to an unknown error`
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="xs">
      <Group wrap="nowrap" align="flex-end">
        <TextInput
          {...inputProps}
          flex={1}
          onClick={bridge && !inputProps.readOnly ? selectPath : inputProps.onClick}
        />
        {bridge && (
          <Tooltip label={label}>
            <ActionIcon
              aria-label={label}
              size="input-sm"
              variant="light"
              disabled={inputProps.disabled || inputProps.readOnly}
              loading={loading}
              onClick={selectPath}
            >
              <IconFolderOpen size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <ErrorAlert error={error} />
    </Stack>
  );
}
