import { i18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Badge } from "@mantine/core";

type Props = {
  retention: string;
};

const labels: Record<string, MessageDescriptor> = {
  latest: msg`Latest Snapshots`,
  hourly: msg`Hourly`,
  daily: msg`Daily`,
  weekly: msg`Weekly`,
  monthly: msg`Monthly`,
  annual: msg`Annual`
};

export default function RetentionBadge({ retention }: Props) {
  const getColor = () => {
    if (retention.startsWith("latest-")) {
      return "green";
    }
    if (retention.startsWith("daily-")) {
      return "indigo";
    }
    if (retention.startsWith("weekly-")) {
      return "red";
    }
    if (retention.startsWith("monthly-")) {
      return "gray";
    }
    if (retention.startsWith("annual-")) {
      return "yellow";
    }
    return "teal";
  };

  return (
    <Badge tt="none" color={getColor()} radius={5}>
      {labels[retention.split("-")[0]]
        ? retention.replace(/^[^-]+/, i18n._(labels[retention.split("-")[0]]))
        : retention}
    </Badge>
  );
}
