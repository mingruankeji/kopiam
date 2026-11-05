import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Fieldset, Group, Loader, NumberInput, Select, Stack, Switch, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { showNotification } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { useAppContext } from "../core/context/AppContext";
import { useServerInstanceContext } from "../core/context/ServerInstanceContext";
import { ErrorAlert } from "../core/ErrorAlert/ErrorAlert";
import useApiRequest from "../core/hooks/useApiRequest";
import type { Preferences, RestorePreferences } from "../core/types";
import { defaultRestorePreferences } from "./restorePreferences";

export default function RestoreSection() {
  const { kopiaService } = useServerInstanceContext();
  const { reloadPreferences } = useAppContext();
  const [preferences, setPreferences] = useState<Preferences>();
  const form = useForm<RestorePreferences>({
    mode: "controlled",
    initialValues: defaultRestorePreferences,
    validate: {
      restoreDirEntryAtDepth: (value) =>
        Number.isInteger(value) && value >= 0 && value <= 2147483647 ? null : t`Invalid value`,
      minSizeForPlaceholder: (value) =>
        Number.isInteger(value) && value >= 0 && value <= 2147483647 ? null : t`Invalid value`
    }
  });
  const load = useApiRequest({
    action: () => kopiaService.getPreferences(),
    onReturn(resp) {
      setPreferences(resp);
      form.initialize({ ...defaultRestorePreferences, ...resp.restore });
    }
  });
  const save = useApiRequest<Preferences, RestorePreferences>({
    action: async (restore) => {
      const current = await kopiaService.getPreferences();
      if (current.isError) {
        return current;
      }
      if (!current.data) throw new Error("UI preferences response is missing");
      return kopiaService.setPreferences({ ...current.data, restore });
    },
    onReturn() {
      reloadPreferences();
      showNotification({ title: t`Updated`, message: t`Preferences updated`, color: "green" });
    }
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the selected server changes
  useEffect(() => {
    load.execute();
  }, [kopiaService]);

  if (load.loading) {
    return <Loader />;
  }

  return (
    <form onSubmit={form.onSubmit((values) => save.execute(values))}>
      <Stack>
        <ErrorAlert error={load.error || save.error} />
        <Text size="sm" c="dimmed">
          <Trans>
            These defaults apply to every restore. Existing files and directories always require confirmation.
          </Trans>
        </Text>
        <Select
          label={t`Restore format`}
          allowDeselect={false}
          data={[
            { label: t`Directory`, value: "directory" },
            { label: t`Zip File`, value: "zip" },
            { label: t`Tar File`, value: "tar" }
          ]}
          {...form.getInputProps("type")}
        />
        <Fieldset legend={t`General Options`}>
          <Stack>
            <Switch
              label={t`Skip previously restored files and symlinks`}
              color="green"
              {...form.getInputProps("incremental", { type: "checkbox" })}
            />
            <Switch
              label={t`Continue on Errors`}
              description={t`When a restore error occurs, attempt to continue instead of failing fast`}
              color="green"
              {...form.getInputProps("continueOnErrors", { type: "checkbox" })}
            />
            <Group grow>
              <NumberInput
                label={t`Shallow Restore At Depth`}
                min={0}
                {...form.getInputProps("restoreDirEntryAtDepth")}
              />
              <NumberInput
                label={t`Minimal File Size For Shallow Restore`}
                min={0}
                {...form.getInputProps("minSizeForPlaceholder")}
              />
            </Group>
          </Stack>
        </Fieldset>
        <Fieldset legend={t`Directory Options`}>
          <Stack>
            <Switch
              label={t`Restore File Ownership`}
              color="green"
              {...form.getInputProps("restoreOwnership", { type: "checkbox" })}
            />
            <Switch
              label={t`Restore File Permissions`}
              color="green"
              {...form.getInputProps("restorePermissions", { type: "checkbox" })}
            />
            <Switch
              label={t`Restore File Modification Time`}
              color="green"
              {...form.getInputProps("restoreModTimes", { type: "checkbox" })}
            />
            <Switch
              label={t`Overwrite Files`}
              color="green"
              {...form.getInputProps("overwriteFiles", { type: "checkbox" })}
            />
            <Switch
              label={t`Overwrite Directories`}
              color="green"
              {...form.getInputProps("overwriteDirectories", { type: "checkbox" })}
            />
            <Switch
              label={t`Overwrite Symbolic Links`}
              color="green"
              {...form.getInputProps("overwriteSymlinks", { type: "checkbox" })}
            />
            <Switch
              label={t`Ignore Permission Errors`}
              color="green"
              {...form.getInputProps("ignorePermissionErrors", { type: "checkbox" })}
            />
            <Switch
              label={t`Write files atomically`}
              color="green"
              {...form.getInputProps("writeFilesAtomically", { type: "checkbox" })}
            />
            <Switch
              label={t`Write Sparse Files`}
              color="green"
              {...form.getInputProps("writeSparseFiles", { type: "checkbox" })}
            />
          </Stack>
        </Fieldset>
        <Fieldset legend={t`Zip options`}>
          <Switch
            label={t`Disable ZIP compression`}
            description={t`Do not compress when restoring to a ZIP file (faster).`}
            color="green"
            {...form.getInputProps("uncompressedZip", { type: "checkbox" })}
          />
        </Fieldset>
        <Group justify="flex-end">
          <Button type="submit" color="green" loading={save.loading} disabled={!preferences}>
            <Trans>Save</Trans>
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
