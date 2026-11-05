import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Alert, Group, Loader, Stack, Text } from "@mantine/core";
import { IconBan, IconCircleCheckFilled, IconCircleXFilled } from "@tabler/icons-react";
import TimeDuration from "../../core/TimeDuration";
import type { Task } from "../../core/types";

type Props = {
  task: Task;
};

export default function TaskSummaryDisplay({ task }: Props) {
  switch (task.status) {
    case "RUNNING":
      return (
        <Alert title={t`Task in progress`}>
          <Group gap="xs">
            <Loader type="dots" size="xs" />
            <Text fz="sm">
              <Trans>Running for</Trans> <TimeDuration from={task.startTime} to={new Date().toISOString()} />
            </Text>
            {task.progressInfo && (
              <Text fz="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {task.progressInfo}
              </Text>
            )}
          </Group>
        </Alert>
      );
    case "SUCCESS":
      return (
        <Alert color="green" title={t`Task succeeded`}>
          <Group gap="xs">
            <IconCircleCheckFilled color="var(--mantine-color-green-5)" />
            <Text fz="sm">
              <Trans>Finished in</Trans> <TimeDuration from={task.startTime} to={task.endTime!} />
            </Text>
          </Group>
        </Alert>
      );
    case "FAILED":
      return (
        <Alert color="red" title={t`Task failed`}>
          <Group gap="xs">
            <IconCircleXFilled color="var(--mantine-color-red-5)" />
            <Stack gap="xs">
              <Text fz="sm">
                <Trans>Failed after</Trans> <TimeDuration from={task.startTime} to={task.endTime!} />
              </Text>
              {task.errorMessage && (
                <Text fz="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {task.errorMessage}
                </Text>
              )}
            </Stack>
          </Group>
        </Alert>
      );
    case "CANCELED":
      return (
        <Alert color="yellow" title={t`Task canceled`}>
          <Group gap="xs">
            <IconBan color="var(--mantine-color-yellow-5)" />
            <Text fz="sm">
              <Trans>Canceled after</Trans> <TimeDuration from={task.startTime} to={task.endTime!} />
            </Text>
          </Group>
        </Alert>
      );
    case "CANCELING":
      return (
        <Alert color="yellow" title={t`Canceling task`}>
          <Group gap="xs">
            <IconBan color="var(--mantine-color-yellow-5)" />
            <Text fz="sm">
              <Trans>Canceling for</Trans> <TimeDuration from={task.startTime} to={new Date().toISOString()} />
            </Text>
          </Group>
        </Alert>
      );
  }
}
