import { Trans } from "@lingui/react/macro";
import { Group, Text } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconInfoCircle,
  IconSearch
} from "@tabler/icons-react";
import IconWrapper from "../../core/IconWrapper";

type Props = {
  severity: number;
};

export default function NotificationSeverityDisplay({ severity }: Props) {
  switch (severity) {
    case -100:
      return (
        <Group gap="xs">
          <IconWrapper icon={IconInfoCircle} color="gray" size={18} />
          <Text>
            <Trans>Verbose</Trans>
          </Text>
        </Group>
      );
    case -10:
      return (
        <Group gap="xs">
          <IconWrapper icon={IconCircleCheckFilled} color="green" size={18} />
          <Text>
            <Trans>Success</Trans>
          </Text>
        </Group>
      );
    case 0:
      return (
        <Group gap="xs">
          <IconWrapper icon={IconSearch} color="grape" size={18} />
          <Text>
            <Trans>Report</Trans>
          </Text>
        </Group>
      );
    case 10:
      return (
        <Group gap="xs">
          <IconWrapper icon={IconAlertTriangle} color="yellow" size={18} />
          <Text>
            <Trans>Warning</Trans>
          </Text>
        </Group>
      );
    case 20:
      return (
        <Group gap="xs">
          <IconWrapper icon={IconCircleXFilled} color="red" size={18} />
          <Text>
            <Trans>Error</Trans>
          </Text>
        </Group>
      );
  }
}
