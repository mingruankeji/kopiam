import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Stack } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import { useState } from "react";
import { ErrorAlert } from "../../core/ErrorAlert/ErrorAlert";
import type { ErrorInformation } from "../../core/hooks/useApiRequest";
import { isKopiaEmbedded } from "../../core/uiService";

export default function BrowseMountedDirectory({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorInformation>();
  const browse = isKopiaEmbedded ? window.kopiaUI?.browseDirectory : undefined;
  if (!browse) return null;

  async function openDirectory() {
    if (!browse || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const message = await browse(path);
      if (message) throw new Error(message);
    } catch (error) {
      setError({
        title: t`Unable to browse mounted directory`,
        message: error instanceof Error ? error.message : t`Failed due to an unknown error`
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="xs" mt="xs">
      <Button
        size="xs"
        variant="light"
        leftSection={<IconFolderOpen size={16} />}
        loading={loading}
        onClick={openDirectory}
      >
        <Trans>Browse mounted directory</Trans>
      </Button>
      <ErrorAlert error={error} />
    </Stack>
  );
}
