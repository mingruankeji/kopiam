// ./test-utils/render.tsx

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { MantineProvider } from "@mantine/core";
import "../../src/i18n";
import { render as testingLibraryRender } from "@testing-library/react";

export function render(ui: React.ReactNode) {
  return testingLibraryRender(<>{ui}</>, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <I18nProvider i18n={i18n}>
        <MantineProvider env="test">{children}</MantineProvider>
      </I18nProvider>
    )
  });
}
