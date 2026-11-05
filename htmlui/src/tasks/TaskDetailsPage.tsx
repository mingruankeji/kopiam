import { Trans } from "@lingui/react/macro";
import { ActionIcon, Button, Container, Divider, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconBan, IconClockPlay, IconClockStop, IconStopwatch } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useServerInstanceContext } from "../core/context/ServerInstanceContext";
import { ErrorAlert } from "../core/ErrorAlert/ErrorAlert";
import FormattedDate from "../core/FormattedDate";
import useApiRequest from "../core/hooks/useApiRequest";
import { useInterval } from "../core/hooks/useInterval";
import IconWrapper from "../core/IconWrapper";
import TimeDuration from "../core/TimeDuration";
import type { Task } from "../core/types";
import TaskCounterGrid from "./components/TaskCounterGrid";
import { getTaskKindLabel } from "./components/TaskKindDisplay";
import TaskLogs from "./components/TaskLogs";
import TaskSummaryDisplay from "./components/TaskSummaryDisplay";

function TaskDetailsPage({ taskId }: { taskId?: string }) {
  const { kopiaService } = useServerInstanceContext();
  const { tid } = useParams();
  const id = taskId ?? tid ?? "";
  const navigate = useNavigate();
  const [data, setData] = useState<Task>();
  const activeTaskId = useRef(id);
  activeTaskId.current = id;
  const getTask = useCallback((taskId?: string) => kopiaService.getTask(taskId!), [kopiaService]);
  const onReturn = useCallback((task: Task, taskId?: string) => {
    if (taskId === activeTaskId.current) setData(task);
  }, []);
  const taskApi = useApiRequest({
    action: getTask,
    onReturn
  });
  const cancelTask = useApiRequest({
    action: () => kopiaService.cancelTask(id),
    onReturn() {
      taskApi.execute(id, "refresh");
    }
  });

  useInterval(
    () => {
      if (!taskApi.loading) taskApi.execute(id, "refresh");
    },
    data?.status === "RUNNING" || data?.status === "CANCELING" ? 1000 : null
  );

  useEffect(() => {
    if (id) {
      setData(undefined);
      taskApi.execute(id, "loading");
    }
  }, [id, taskApi.execute]);

  return (
    <Container fluid>
      <Stack>
        <Group>
          {!taskId && (
            <ActionIcon variant="subtle" onClick={() => navigate(-1)}>
              <IconArrowLeft size={24} />
            </ActionIcon>
          )}
          <Title order={taskId ? 3 : 1} style={{ overflowWrap: "anywhere" }}>
            {data && getTaskKindLabel(data.kind)}: {data?.description}
          </Title>
          {data?.status === "RUNNING" && (
            <Button
              color="red"
              variant="light"
              size="xs"
              leftSection={<IconBan size={16} />}
              loading={cancelTask.loading}
              onClick={() => cancelTask.execute()}
            >
              <Trans>Cancel task</Trans>
            </Button>
          )}
        </Group>
        <ErrorAlert error={taskApi.error || cancelTask.error} />
        {data && <TaskSummaryDisplay task={data} />}
        <Group grow>
          <Paper withBorder radius="md" p="xs">
            <Group wrap="nowrap">
              <IconWrapper icon={IconClockPlay} size={32} color="green" />
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  <Trans>Started</Trans>
                </Text>
                <Text fw={700} size="xl">
                  {data?.startTime ? <FormattedDate value={data.startTime} /> : "-"}
                </Text>
              </div>
            </Group>
          </Paper>
          <Paper withBorder radius="md" p="xs">
            <Group wrap="nowrap">
              <IconWrapper icon={IconClockStop} size={32} color="blue" />
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  <Trans>Finished</Trans>
                </Text>
                <Text fw={700} size="xl">
                  {data?.endTime ? <FormattedDate value={data.endTime} /> : "-"}
                </Text>
              </div>
            </Group>
          </Paper>
          <Paper withBorder radius="md" p="xs">
            <Group>
              <IconWrapper icon={IconStopwatch} size={32} color="teal" />
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  <Trans>Duration</Trans>
                </Text>
                <Text fw={700} size="xl">
                  {data?.startTime && <TimeDuration from={data.startTime} to={data.endTime ?? new Date().toString()} />}
                </Text>
              </div>
            </Group>
          </Paper>
        </Group>
        <Divider />
        {data && data.counters != null && <TaskCounterGrid task={data} showZeroCounters={false} />}
        {data && <TaskLogs task={data} />}
      </Stack>
    </Container>
  );
}

export default TaskDetailsPage;
