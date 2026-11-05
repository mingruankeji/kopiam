import { Trans } from "@lingui/react/macro";
import { Alert, Code, Stack, Text } from "@mantine/core";
import type { DirectorySummary } from "./types";

type Props = {
  summary?: DirectorySummary;
  incomplete?: string;
};

export default function SnapshotWarnings({ summary, incomplete }: Props) {
  const reason = incomplete || summary?.incomplete;
  const failedEntries = summary?.failedEntries || [];
  const failedCount = Math.max(summary?.numFailed || 0, failedEntries.length);
  if (!reason && !failedCount && !summary?.ignoredErrorCount) return null;

  return (
    <Alert color="orange">
      <Stack gap="xs">
        {reason && (
          <Text size="sm">
            <Trans>Incomplete snapshot</Trans>: {reason}
          </Text>
        )}
        {failedCount > 0 && (
          <Text size="sm">
            <Trans>Failed entries</Trans>: {failedCount}
          </Text>
        )}
        {failedEntries.map((entry, index) => (
          <Stack gap={2} key={`${entry.path}-${index}`}>
            <Code style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.path}</Code>
            <Text size="xs" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {entry.error}
            </Text>
          </Stack>
        ))}
        {failedCount > failedEntries.length && (
          <Text size="xs">
            <Trans>Additional failed entry details are not available.</Trans>
          </Text>
        )}
        {!!summary?.ignoredErrorCount && (
          <Text size="xs">
            <Trans>Ignored errors</Trans>: {summary.ignoredErrorCount}
          </Text>
        )}
      </Stack>
    </Alert>
  );
}
