import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { MantineColor } from "@mantine/core";
import {
  IconAsterisk,
  IconBrandAmazon,
  IconBrandAzure,
  IconBrandGoogleDrive,
  IconCloudComputing,
  IconFolder,
  IconFolderOpen,
  IconInfoCircle,
  IconRefresh,
  IconServer,
  IconServer2
} from "@tabler/icons-react";
export const supportedProviders: {
  provider: string;
  description: MessageDescriptor;
  color: MantineColor;
  icon: typeof IconCloudComputing;
}[] = [
  {
    provider: "filesystem",
    description: msg`Local Directory or NAS`,
    icon: IconFolderOpen,
    color: "orange"
  },
  {
    provider: "gcs",
    description: msg`Google Cloud Storage`,
    icon: IconBrandGoogleDrive,
    color: "yellow"
  },
  {
    provider: "s3",
    description: msg`Amazon S3 or Compatible Storage`,
    icon: IconBrandAmazon,
    color: "orange"
  },
  {
    provider: "b2",
    description: msg`Backblaze B2`,
    icon: IconInfoCircle,
    color: "red"
  },
  {
    provider: "azureBlob",
    description: msg`Azure Blob Storage`,
    icon: IconBrandAzure,
    color: "blue"
  },
  {
    provider: "sftp",
    description: msg`SFTP Server`,
    icon: IconServer2,
    color: "teal"
  },
  {
    provider: "rclone",
    description: msg`Rclone Remote`,
    icon: IconRefresh,
    color: "grape"
  },
  {
    provider: "webdav",
    description: msg`WebDAV Server`,
    icon: IconFolder,
    color: "indigo"
  },
  {
    provider: "_server",
    description: msg`Kopia Repository Server`,
    icon: IconServer,
    color: "lime"
  },
  {
    provider: "_token",
    description: msg`Use Repository Token`,
    icon: IconAsterisk,
    color: "violet"
  }
];
