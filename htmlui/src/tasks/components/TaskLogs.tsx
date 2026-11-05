import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Card, CardSection, Group, LoadingOverlay, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerInstanceContext } from "../../core/context/ServerInstanceContext";
import { ErrorAlert } from "../../core/ErrorAlert/ErrorAlert";
import useApiRequest from "../../core/hooks/useApiRequest";
import { useInterval } from "../../core/hooks/useInterval";
import type { LogEntry, Task } from "../../core/types";
import { formatLogLine } from "../../utils/formatLogLine";

type Props = {
  task: Task;
};

export default function TaskLogs({ task }: Props) {
  const { kopiaService } = useServerInstanceContext();
  const [data, setData] = useState<LogEntry[]>([]);
  const [query, setQuery] = useState("");
  const activeTaskId = useRef(task.id);
  activeTaskId.current = task.id;
  const getLogs = useCallback((id?: string) => kopiaService.getTaskLogs(id!), [kopiaService]);
  const onReturn = useCallback((resp: { logs: LogEntry[] | null }, id?: string) => {
    if (id === activeTaskId.current) setData(resp.logs ?? []);
  }, []);
  const taskAction = useApiRequest({
    action: getLogs,
    onReturn
  });

  useEffect(() => {
    if (task.id) setData([]);
  }, [task.id]);

  useEffect(() => {
    taskAction.execute(task.id, task.status === "RUNNING" ? "loading" : "refresh");
  }, [task.id, task.status, taskAction.execute]);

  useInterval(
    () => {
      if (!taskAction.loading) taskAction.execute(task.id, "refresh");
    },
    task.status === "RUNNING" || task.status === "CANCELING" ? 3000 : null
  );

  const logs = useMemo(() => {
    const recent = new Set(data.filter((entry) => entry.level < 3).slice(-100));
    return data.filter((entry) => entry.level >= 3 || recent.has(entry));
  }, [data]);
  const visibleLogs = logs.filter((entry) =>
    formatLogLine(entry).toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );

  return (
    <Card withBorder shadow="sm" radius="md">
      <CardSection withBorder inheritPadding py="xs">
        <Group justify="space-between">
          <Text fw={500}>
            <Trans>Logs</Trans>
          </Text>
          <Text size="xs" c="dimmed">
            <Trans>Latest 100 non-error logs and all errors</Trans>
          </Text>
        </Group>
      </CardSection>
      <CardSection inheritPadding py="sm" pos="relative">
        <LoadingOverlay visible={taskAction.loading && taskAction.loadingKey === "loading"} />
        <Stack gap="xs">
          <ErrorAlert error={taskAction.error} />
          <TextInput
            aria-label={t`Search logs`}
            placeholder={t`Search logs`}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <ScrollArea.Autosize mah={400}>
            <Stack gap={4}>
              {visibleLogs.map((entry, index) => (
                <Text
                  key={`${entry.ts}-${index}`}
                  size="xs"
                  ff="monospace"
                  c={entry.level >= 3 ? "red" : entry.level === 2 ? "yellow" : undefined}
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {formatLogLine(entry)}
                </Text>
              ))}
              {visibleLogs.length === 0 && !taskAction.loading && (
                <Text size="sm" c="dimmed">
                  <Trans>No logs to display</Trans>
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Stack>
      </CardSection>
    </Card>
  );
}
