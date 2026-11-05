import { Trans } from "@lingui/react/macro";
import { Group, HoverCard, Loader, Progress, Stack, Text } from "@mantine/core";
import type { UploadCounters } from "../../core/types";
import sizeDisplayName from "../../utils/formatSize";

type Props = {
  data?: UploadCounters;
  bytesStringBase2: boolean;
};

export default function UploadingLoader({ data, bytesStringBase2 }: Props) {
  if (data === undefined)
    return (
      <Group>
        <Loader size="xs" type="dots" />
        <Text fz="xs">
          <Trans>Uploading</Trans>
        </Text>
      </Group>
    );
  const totalBytes = data.hashedBytes + data.cachedBytes;
  const totalBytesString = sizeDisplayName(totalBytes, bytesStringBase2);

  const estimatedBytesString = sizeDisplayName(data.estimatedBytes, bytesStringBase2);
  const percent = data.estimatedBytes ? Math.round((totalBytes * 1000.0) / data.estimatedBytes) / 10.0 : 0;

  return (
    <HoverCard width={360} shadow="md" withinPortal>
      <HoverCard.Target>
        <Stack gap={5} miw={100} tabIndex={0}>
          {data.estimatedBytes > 0 ? (
            <>
              <Progress value={Math.min(percent, 100)} animated striped />
              <Text fz="xs" ta="center">
                {totalBytesString} / {estimatedBytesString} ({percent}%)
              </Text>
            </>
          ) : (
            <Group>
              <Loader size="xs" type="dots" />
              <Text fz="xs">{totalBytesString}</Text>
            </Group>
          )}
        </Stack>
      </HoverCard.Target>
      <HoverCard.Dropdown>
        <Stack gap={4}>
          <Text size="xs">
            <Trans>Hashed files</Trans>: {data.hashedFiles} ({sizeDisplayName(data.hashedBytes, bytesStringBase2)})
          </Text>
          <Text size="xs">
            <Trans>Cached files</Trans>: {data.cachedFiles} ({sizeDisplayName(data.cachedBytes, bytesStringBase2)})
          </Text>
          <Text size="xs">
            <Trans>Uploaded bytes</Trans>: {sizeDisplayName(data.uploadedBytes, bytesStringBase2)}
          </Text>
          <Text size="xs">
            <Trans>Errors</Trans>: {data.errors} / <Trans>Ignored errors</Trans>: {data.ignoredErrors}
          </Text>
          <Text size="xs" style={{ overflowWrap: "anywhere" }}>
            <Trans>Directory</Trans>: {data.directory}
          </Text>
          {data.lastError && (
            <Text size="xs" c="red" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {data.lastErrorPath}
              {"\n"}
              {data.lastError}
            </Text>
          )}
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
