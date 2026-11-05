import { i18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Badge, type MantineColor } from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowsSplit,
  IconCalendarX,
  IconClock,
  IconDeviceLaptop,
  IconFileCode,
  IconFileText,
  IconFileZip,
  IconFolderCog,
  IconFolderOpen,
  IconQuestionMark,
  IconUpload
} from "@tabler/icons-react";
import IconWrapper from "../../core/IconWrapper";

type Props = {
  policyFeature: string;
};

const policyFeatures: {
  [key: string]: {
    color: MantineColor;
    icon: typeof IconClock;
    displayName: MessageDescriptor;
  };
} = {
  retention: {
    color: "teal",
    icon: IconCalendarX,
    displayName: msg`Retention`
  },
  files: {
    icon: IconFolderOpen,
    color: "yellow",
    displayName: msg`Files`
  },
  errorHandling: {
    icon: IconAlertTriangle,
    color: "red",
    displayName: msg`Error Handling`
  },
  scheduling: {
    icon: IconClock,
    color: "green",
    displayName: msg`Scheduling`
  },
  compression: {
    icon: IconFileZip,
    color: "grape",
    displayName: msg`Compression`
  },
  metadataCompression: {
    icon: IconFileCode,
    color: "gray",
    displayName: msg`Metadata Compression`
  },
  splitter: {
    icon: IconArrowsSplit,
    color: "lime",
    displayName: msg`Splitter`
  },
  actions: {
    icon: IconFolderCog,
    color: "lime",
    displayName: msg`Actions`
  },
  osSnapshots: {
    icon: IconDeviceLaptop,
    color: "orange",
    displayName: msg`OS Snapshots`
  },
  logging: {
    icon: IconFileText,
    color: "violet",
    displayName: msg`Logging`
  },
  upload: {
    icon: IconUpload,
    color: "blue",
    displayName: msg`Upload`
  }
};

export default function PolicyFeatureBadge({ policyFeature }: Props) {
  const feature = policyFeatures[policyFeature] || {
    icon: IconQuestionMark,
    color: "blue",
    displayName: { message: policyFeature }
  };

  return (
    <Badge tt="none" color={feature.color} radius={5} leftSection={<IconWrapper icon={feature.icon} />}>
      {i18n._(feature.displayName)}
    </Badge>
  );
}
