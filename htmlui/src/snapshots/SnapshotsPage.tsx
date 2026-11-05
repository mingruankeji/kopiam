import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  Title,
  Tooltip
} from "@mantine/core";
import { useDisclosure, useLocalStorage } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import {
  IconBan,
  IconCircleCheck,
  IconClick,
  IconClockExclamation,
  IconFileCertificate,
  IconFileDatabase,
  IconFileText,
  IconFolderOpen,
  IconPackageExport,
  IconRefreshAlert
} from "@tabler/icons-react";
import sortBy from "lodash.sortby";
import type { DataTableSortStatus } from "mantine-datatable";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import CLIEquivalent from "../core/CLIEquivalent";
import { newActionProps, refreshButtonProps } from "../core/commonButtons";
import { useAppContext } from "../core/context/AppContext";
import { useServerInstanceContext } from "../core/context/ServerInstanceContext";
import { DataGrid } from "../core/DataGrid/DataGrid";
import { ErrorAlert } from "../core/ErrorAlert/ErrorAlert";
import useApiRequest from "../core/hooks/useApiRequest";
import { useInterval } from "../core/hooks/useInterval";
import IconWrapper from "../core/IconWrapper";
import { MenuButton } from "../core/MenuButton/MenuButton";
import RelativeDate from "../core/RelativeDate";
import type { SourceInfo, SourceStatus, Sources } from "../core/types";
import TaskDetailsPage from "../tasks/TaskDetailsPage";
import { formatOwnerName } from "../utils/formatOwnerName";
import sizeDisplayName from "../utils/formatSize";
import { isPastDateTime } from "../utils/isPasteDateTime";
import { onlyUnique } from "../utils/onlyUnique";
import UploadingLoader from "./components/UploadingLoader";
import NewSnapshotModal from "./modals/NewSnapshotModal";

function SnapshotsPage() {
  const { kopiaService } = useServerInstanceContext();
  const [show, setShow] = useDisclosure();
  const preferences = useAppContext();
  const { pageSize: tablePageSize, bytesStringBase2, locale, defaultSnapshotViewAll, reloadPreferences } = preferences;
  const [data, setData] = useState<Sources>();
  const [filterState, setFilterState] = useState<"all" | "local" | string>(defaultSnapshotViewAll ? "all" : "local");
  const [logTaskId, setLogTaskId] = useState<string>();
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<SourceStatus>>({
    columnAccessor: "source.path",
    direction: "asc"
  });
  const [refreshInterval, setRefreshInterval] = useLocalStorage<number | null>({
    key: "kopia-alt-ui-snapshot-refresh",
    defaultValue: 3000,
    getInitialValueInEffect: false
  });

  const activeRefreshInterval = useMemo(() => {
    if (data?.sources !== undefined && data.sources.some((x) => x.status === "PENDING" || x.status === "UPLOADING")) {
      return 3000;
    }
    return refreshInterval;
  }, [refreshInterval, data]);

  const visibleData = useMemo(() => {
    if (data === undefined) return [];

    let filterable = [...data.sources];

    switch (filterState) {
      case "all":
        break;
      case "local":
        filterable = filterable.filter((x) => formatOwnerName(x.source) === data.localUsername + "@" + data.localHost);
        break;
      default:
        filterable = filterable.filter((x) => formatOwnerName(x.source) === filterState);
    }

    const entries = sortBy(filterable, sortStatus.columnAccessor) as SourceStatus[];
    return sortStatus.direction === "desc" ? entries.reverse() : entries;
  }, [data, filterState, sortStatus]);

  const loadAction = useApiRequest({
    action: () => kopiaService.getSnapshots(),
    onReturn: setData
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: only load data on mount
  useEffect(() => {
    loadAction.execute(undefined, "loading");
  }, []);

  useInterval(() => {
    loadAction.execute(undefined, "fetch");
  }, activeRefreshInterval);

  const uniqueOwners = (data?.sources || [])
    .map((x) => formatOwnerName(x.source))
    .filter(onlyUnique)
    .sort();

  const newSnapshotActions = useApiRequest({
    action: (data?: SourceInfo) => kopiaService.startSnapshot(data!),
    onReturn() {
      loadAction.execute(undefined, "refresh");
    }
  });
  const cancelSnapshotAction = useApiRequest({
    action: (source?: SourceInfo) => kopiaService.cancelSnapshot(source!),
    showErrorAsNotification: true,
    onReturn() {
      loadAction.execute(undefined, "refresh");
    }
  });
  const saveViewAction = useApiRequest({
    action: (view?: string) =>
      kopiaService.setPreferences({
        restore: preferences.restore,
        bytesStringBase2: preferences.bytesStringBase2,
        defaultSnapshotViewAll: view === "all",
        fontSize: preferences.fontSize,
        language: preferences.language,
        locale: preferences.locale,
        pageSize: preferences.pageSize,
        theme: preferences.theme
      }),
    showErrorAsNotification: true,
    onReturn: reloadPreferences
  });
  const syncAction = useApiRequest({
    action: () => kopiaService.syncRepo(),
    showErrorAsNotification: true,
    onReturn() {
      loadAction.execute(undefined, "refresh");
      showNotification({
        title: t`Repository synchronized`,
        message: t`The repository was synchronized successfully`,
        color: "green",
        icon: <IconCircleCheck size={16} />
      });
    }
  });
  const intError = loadAction.error || newSnapshotActions.error;

  return (
    <Container fluid>
      <Stack>
        <Title order={1}>
          <Trans>Snapshots</Trans>
        </Title>
        <Group justify="space-between">
          <Group>
            <MenuButton
              prefix={t`Refresh` + ":"}
              options={[
                { label: t`Disabled`, value: "" },
                { label: t`3 seconds`, value: "3000" },
                { label: t`10 seconds`, value: "15000" },
                { label: t`30 seconds`, value: "30000" },
                { label: t`1 minute`, value: "60000" },
                { label: t`5 minutes`, value: "300000" }
              ]}
              value={refreshInterval?.toString()}
              onClick={(val) => setRefreshInterval(val === "" ? null : parseInt(val))}
            />
            {data?.multiUser === true && (
              <MenuButton
                value={filterState}
                options={[
                  { label: <Trans>All Snapshots</Trans>, value: "all" },
                  { label: <Trans>Local Snapshots</Trans>, value: "local" },
                  { label: "", value: "divider" },
                  ...uniqueOwners.map((own) => ({
                    label: own,
                    value: own
                  }))
                ]}
                onClick={(view) => {
                  setFilterState(view);
                  if (view === "all" || view === "local") saveViewAction.execute(view);
                }}
                disabled={loadAction.loading && loadAction.loadingKey == "loading"}
              />
            )}
          </Group>
          <Group>
            <Button component={Link} to="/tasks?kind=Snapshot" variant="light" leftSection={<IconFileText size={16} />}>
              <Trans>Snapshot logs</Trans>
            </Button>
            <Button
              disabled={loadAction.loading && loadAction.loadingKey == "loading"}
              onClick={setShow.open}
              {...newActionProps}
            >
              <Trans>New Snapshot</Trans>
            </Button>
            <Button
              loading={loadAction.loading && loadAction.loadingKey === "refresh"}
              onClick={() => loadAction.execute(undefined, "refresh")}
              {...refreshButtonProps}
            >
              <Trans>Refresh</Trans>
            </Button>
            <Button
              loading={syncAction.loading}
              onClick={() => syncAction.execute()}
              {...refreshButtonProps}
              leftSection={<IconRefreshAlert size={16} />}
              color="grape"
            >
              <Trans>Sync</Trans>
            </Button>
          </Group>
        </Group>
        <Divider />
        <ErrorAlert error={intError} />
        <DataGrid
          records={visibleData}
          loading={loadAction.loading && loadAction.loadingKey === "loading"}
          idAccessor="source.path"
          noRecordsText={t`No snapshots taken`}
          noRecordsIcon={<IconWrapper icon={IconFileDatabase} size={48} />}
          pageSize={tablePageSize}
          sortStatus={sortStatus}
          onSortStatusChange={setSortStatus}
          columns={[
            {
              accessor: "source.path",
              title: <Trans>Path</Trans>,
              sortable: true,
              render: (item) => (
                <Group gap="5">
                  <IconWrapper icon={IconFolderOpen} color="yellow" size={18} />
                  <Anchor
                    component={Link}
                    to={{
                      pathname: "/snapshots/single-source",
                      search: `?userName=${item.source.userName}&host=${item.source.host}&path=${encodeURIComponent(item.source.path)}`
                    }}
                    td="none"
                    fz="sm"
                  >
                    {item.source.path}
                  </Anchor>
                </Group>
              )
            },
            {
              accessor: "owner",
              title: <Trans>Owner</Trans>,
              sortable: true,
              visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`,
              render: (item) =>
                item.status === "REMOTE" ? (
                  <Group gap="xs" align="center">
                    <Text fz="sm">{`${item.source.userName}@${item.source.host}`}</Text>
                    <Badge size="sm" radius={5} tt="none" variant="light" color="grape">
                      <Trans>Remote</Trans>
                    </Badge>
                  </Group>
                ) : (
                  `${item.source.userName}@${item.source.host}`
                )
            },
            {
              accessor: "lastSnapshot.rootEntry.summ.size",
              sortable: true,
              title: <Trans>Size</Trans>,
              visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.md})`,
              render: (item) =>
                item.lastSnapshot?.rootEntry?.summ?.size &&
                sizeDisplayName(item.lastSnapshot.rootEntry.summ.size, bytesStringBase2)
            },
            {
              accessor: "lastSnapshot.startTime",
              sortable: true,
              title: <Trans>Last Snapshot</Trans>,
              render: (item) => item.lastSnapshot && <RelativeDate value={item.lastSnapshot.startTime} />
            },
            {
              accessor: "nextSnapshotTime",
              title: <Trans>Next snapshot</Trans>,
              render: (item) => {
                if (!item.nextSnapshotTime) return undefined;

                return (
                  <Group>
                    <Text fz="sm">{item.nextSnapshotTime && <RelativeDate value={item.nextSnapshotTime} />}</Text>
                    {isPastDateTime(item.nextSnapshotTime, locale) && (
                      <Badge
                        color="yellow"
                        variant="light"
                        radius={3}
                        size="sm"
                        tt="none"
                        leftSection={<IconClockExclamation size={12} />}
                      >
                        <Trans>Overdue</Trans>
                      </Badge>
                    )}
                  </Group>
                );
              }
            },
            {
              accessor: "",
              title: <IconClick size={16} />,
              textAlign: "right",
              width: 300,
              visibleMediaQuery: (theme) => `(min-width: ${theme.breakpoints.sm})`,
              render: (item) => {
                switch (item.status) {
                  case "IDLE":
                  case "PAUSED":
                  case "REMOTE": {
                    return (
                      <Group gap={4} justify="right" wrap="nowrap">
                        {item.status !== "REMOTE" && (
                          <Tooltip label={t`Snapshot Now`}>
                            <ActionIcon
                              variant="subtle"
                              color="green.5"
                              loading={newSnapshotActions.loading}
                              onClick={() => newSnapshotActions.execute(item.source)}
                            >
                              <IconWrapper icon={IconPackageExport} size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}

                        <Tooltip label={t`View Policy`}>
                          <ActionIcon
                            component={Link}
                            to={{
                              pathname: "/policies",
                              search: `userName=${item.source.userName}&host=${item.source.host}&path=${encodeURIComponent(item.source.path)}&viewPolicy=true`
                            }}
                            variant="subtle"
                            color="grape.5"
                          >
                            <IconWrapper icon={IconFileCertificate} size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    );
                  }
                  case "PENDING":
                    return (
                      <Group gap={5}>
                        <IconWrapper icon={IconClockExclamation} color="yellow" />
                        <Text fz="xs" c="yellow">
                          <Trans>Pending</Trans>
                        </Text>
                      </Group>
                    );
                  case "UPLOADING": {
                    return (
                      <Group gap={5} wrap="nowrap">
                        <UploadingLoader data={item.upload} bytesStringBase2={bytesStringBase2} />
                        {item.currentTask && (
                          <Tooltip label={t`Logs`}>
                            <ActionIcon
                              aria-label={t`Logs`}
                              variant="subtle"
                              onClick={() => setLogTaskId(item.currentTask)}
                            >
                              <IconFileText size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label={t`Cancel snapshot`}>
                          <ActionIcon
                            aria-label={t`Cancel snapshot`}
                            variant="subtle"
                            color="red"
                            loading={cancelSnapshotAction.loading}
                            onClick={() => cancelSnapshotAction.execute(item.source)}
                          >
                            <IconBan size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    );
                  }
                  default:
                    return item.status;
                }
              }
            }
          ]}
        />
        <CLIEquivalent command={["snapshot", "list"]} />
      </Stack>
      {logTaskId && (
        <Modal opened onClose={() => setLogTaskId(undefined)} size="xl" title={<Trans>Snapshot logs</Trans>}>
          <TaskDetailsPage key={logTaskId} taskId={logTaskId} />
        </Modal>
      )}
      {show && (
        <NewSnapshotModal
          onSnapshotted={() => {
            setShow.close();
            loadAction.execute(undefined, "refresh");
          }}
          onCancel={setShow.close}
        />
      )}
    </Container>
  );
}

export default SnapshotsPage;
