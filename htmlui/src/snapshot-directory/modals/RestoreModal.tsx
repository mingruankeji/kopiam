import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Group, Modal, SegmentedControl, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { yupResolver } from "mantine-form-yup-resolver";
import { useState } from "react";
import * as Yup from "yup";
import { useAppContext } from "../../core/context/AppContext";
import { useServerInstanceContext } from "../../core/context/ServerInstanceContext";
import { ErrorAlert } from "../../core/ErrorAlert/ErrorAlert";
import useApiRequest from "../../core/hooks/useApiRequest";
import LocalPathInput from "../../core/LocalPathInput";
import type { RestorePreferences, RestoreRequest, Task } from "../../core/types";
import { defaultRestorePreferences } from "../../preferences/restorePreferences";
import modalBaseStyles from "../../styles/modalStyles";
import modalClasses from "../../styles/modals.module.css";

type Props = {
  oid: string;
  onCancel: () => void;
  onRestoreStarted: (task: Task) => void;
};

const schema = Yup.object({
  destination: Yup.string().trim().required().label("Destination")
});

type RestoreForm = RestorePreferences & {
  destination?: string;
};

export default function RestoreModal({ oid, onCancel, onRestoreStarted }: Props) {
  const { kopiaService } = useServerInstanceContext();
  const { restore: preferences } = useAppContext();
  const [pending, setPending] = useState<RestoreRequest>();
  const form = useForm<RestoreForm, RestoreRequest>({
    mode: "controlled",
    initialValues: {
      ...defaultRestorePreferences,
      ...preferences,
      destination: ""
    },
    validate: yupResolver(schema),
    transformValues(values: RestoreForm): RestoreRequest {
      const base = {
        root: oid,
        checkForConflicts: true,
        options: {
          incremental: values.incremental,
          ignoreErrors: values.continueOnErrors,
          restoreDirEntryAtDepth: values.restoreDirEntryAtDepth,
          minSizeForPlaceholder: values.minSizeForPlaceholder
        }
      };
      if (values.type === "zip") {
        return {
          ...base,
          zipFile: values.destination!,
          uncompressedZip: values.uncompressedZip
        };
      }

      if (values.type === "tar") {
        return {
          ...base,
          tarFile: values.destination!
        };
      }

      return {
        ...base,
        fsOutput: {
          targetPath: values.destination!,
          skipOwners: !values.restoreOwnership,
          skipPermissions: !values.restorePermissions,
          skipTimes: !values.restoreModTimes,
          ignorePermissionErrors: values.ignorePermissionErrors,
          overwriteFiles: values.overwriteFiles,
          overwriteDirectories: values.overwriteDirectories,
          overwriteSymlinks: values.overwriteSymlinks,
          writeFilesAtomically: values.writeFilesAtomically,
          writeSparseFiles: values.writeSparseFiles
        }
      };
    }
  });

  const { error, loading, execute } = useApiRequest({
    action: (data?: RestoreRequest) => kopiaService.restore(data!),
    onReturn: (g) => {
      onRestoreStarted(g);
    },
    handleError: (err, request) => {
      if (err.title === "RESTORE_CONFLICT" && request) {
        setPending(request);
        return false;
      }
      return true;
    }
  });
  async function submitForm(values: RestoreRequest) {
    await execute(values);
  }
  return (
    <Modal
      title={t`Restore files and directories`}
      onClose={() => {
        if (!loading) onCancel();
      }}
      opened
      styles={modalBaseStyles}
      className={modalClasses.modalWrapper}
      closeOnClickOutside={false}
      closeOnEscape={!loading}
      withCloseButton={!loading}
      size="lg"
    >
      {pending && (
        <Stack className={modalClasses.container}>
          <ErrorAlert error={error} />
          <Text fw={600}>
            <Trans>The destination already contains files or directories.</Trans>
          </Text>
          <Text>
            <Trans>
              Replace all merges folders and overwrites matching files, keeping other files. Cancel stops the entire
              restore without writing anything.
            </Trans>
          </Text>
          <Text style={{ overflowWrap: "anywhere" }}>
            {"fsOutput" in pending
              ? pending.fsOutput.targetPath
              : "zipFile" in pending
                ? pending.zipFile
                : pending.tarFile}
          </Text>
        </Stack>
      )}
      <form
        hidden={!!pending}
        id="restore-dir-form"
        onSubmit={form.onSubmit(submitForm)}
        className={modalClasses.container}
      >
        <Stack w="100%">
          <ErrorAlert error={error} />
          <SegmentedControl
            withItemsBorders
            data={[
              { label: t`Directory`, value: "directory" },
              { label: t`Zip File`, value: "zip" },
              { label: t`Tar File`, value: "tar" }
            ]}
            {...form.getInputProps("type")}
          />

          <LocalPathInput
            pathKind={form.values.type === "directory" ? "directory" : "save-file"}
            extension={form.values.type === "directory" ? undefined : form.values.type}
            onPathSelected={(path) => form.setFieldValue("destination", path)}
            label={t`Destination`}
            description={t`You can also restore to a .zip or .tar file by providing the appropriate extension`}
            placeholder={t`/my-data/path`}
            rightSection={
              form.values.type !== "directory" && (
                <Text span mr="5">
                  {form.values.type === "zip" ? ".zip" : ".tar"}
                </Text>
              )
            }
            withAsterisk
            {...form.getInputProps("destination")}
          />
          <Text size="sm" c="dimmed">
            <Trans>Restore options are saved in Preferences.</Trans>
          </Text>
        </Stack>
      </form>

      <Group className={modalClasses.footer}>
        <Button size="xs" color="gray" variant="subtle" onClick={onCancel} disabled={loading}>
          <Trans>Cancel</Trans>
        </Button>
        {pending ? (
          <Button size="xs" loading={loading} onClick={() => execute({ ...pending, overwriteConfirmed: true })}>
            <Trans>Replace all</Trans>
          </Button>
        ) : (
          <Button size="xs" type="submit" form="restore-dir-form" loading={loading} disabled={!form.isValid()}>
            <Trans>Begin Restore</Trans>
          </Button>
        )}
      </Group>
    </Modal>
  );
}
