import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Group, LoadingOverlay, Modal, Stack } from "@mantine/core";
import { useEffect, useState } from "react";
import { useServerInstanceContext } from "../../core/context/ServerInstanceContext";
import { ErrorAlert } from "../../core/ErrorAlert/ErrorAlert";
import useApiRequest from "../../core/hooks/useApiRequest";
import { useInterval } from "../../core/hooks/useInterval";
import { type EstimateSnapshotRequest, type Policy, type SourceInfo, type Task } from "../../core/types";
import modalBaseStyles from "../../styles/modalStyles";
import modalClasses from "../../styles/modals.module.css";
import TaskCounterGrid from "../../tasks/components/TaskCounterGrid";
import TaskLogs from "../../tasks/components/TaskLogs";
import TaskStatusDisplay from "../../tasks/components/TaskStatusDisplay";

type Props = {
  policy: Policy;
  source: SourceInfo;
  onCancel: () => void;
};

export default function TaskEstimationModal({ policy, source, onCancel }: Props) {
  const { kopiaService } = useServerInstanceContext();
  const [task, setTask] = useState<Task>();
  const estimateAction = useApiRequest({
    action: (data?: EstimateSnapshotRequest) => kopiaService.estimateSnapshot(data!),
    onReturn: (t) => {
      setTask(t);
    }
  });
  const loadTaskAction = useApiRequest({
    action: (data?: string) => kopiaService.getTask(data!),
    onReturn: (t) => {
      setTask(t);
    }
  });

  // TODO: move hook locally
  useInterval(() => {
    if (task !== undefined && task.endTime === undefined) {
      loadTaskAction.execute(task.id);
    }
  }, 3000);

  // biome-ignore lint/correctness/useExhaustiveDependencies: need-to-fix-later
  useEffect(() => {
    const req: EstimateSnapshotRequest = {
      root: source.path,
      maxExamplesPerBucket: 10,
      policyOverride: policy
    };
    estimateAction.execute(req);
  }, []);

  return (
    <Modal
      title={t`Estimate snapshot`}
      onClose={onCancel}
      opened
      styles={modalBaseStyles}
      className={modalClasses.modalWrapper}
      closeOnClickOutside={false}
      size="lg"
    >
      <Stack w="100%" className={modalClasses.container}>
        <ErrorAlert error={estimateAction.error || loadTaskAction.error} />
        <LoadingOverlay visible={estimateAction.loading} />
        {task && (
          <>
            <TaskStatusDisplay task={task} />
            {task.counters !== null && <TaskCounterGrid task={task} showZeroCounters={false} gridSize={3} />}
            <TaskLogs task={task} />
          </>
        )}
      </Stack>

      <Group className={modalClasses.footer}>
        <Button size="xs" color="gray" variant="subtle" onClick={onCancel} disabled={estimateAction.loading}>
          <Trans>Cancel</Trans>
        </Button>

        <Button size="xs" onClick={onCancel} disabled={estimateAction.loading}>
          <Trans>Close</Trans>
        </Button>
      </Group>
    </Modal>
  );
}
