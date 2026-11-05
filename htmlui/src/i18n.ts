import { i18n, type MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/core/macro";
import { setLocale } from "yup";
// @ts-expect-error PO catalogs are compiled by the Lingui Vite plugin.
import { messages as enMessages } from "./locales/en/messages.po";
// @ts-expect-error PO catalogs are compiled by the Lingui Vite plugin.
import { messages as nbMessages } from "./locales/nb/messages.po";
// @ts-expect-error PO catalogs are compiled by the Lingui Vite plugin.
import { messages as zhMessages } from "./locales/zh/messages.po";

i18n.load({ en: enMessages, nb: nbMessages, zh: zhMessages });
i18n.activate("zh");

const fieldLabels: Record<string, MessageDescriptor> = {
  Name: msg`Name`,
  Description: msg`Description`,
  Path: msg`Path`,
  Username: msg`Username`,
  Password: msg`Password`,
  Severity: msg`Minimum Severity`,
  Endpoint: msg`Endpoint`,
  Method: msg`HTTP Method`,
  Format: msg`Notification Format`,
  Destination: msg`Destination`,
  "App Token": msg`Pushover App Token`,
  "User key": msg`Recipient User Key or Group Key`,
  "SMTP Server": msg`SMTP Server`,
  "SMTP Username": msg`SMTP Username`,
  "SMTP Password": msg`SMTP server password`
};

function fieldName(path: string): string {
  return fieldLabels[path] ? i18n._(fieldLabels[path]) : path;
}

setLocale({
  mixed: {
    required: ({ path }) => {
      const field = fieldName(path);
      return t`${field} is required`;
    },
    notType: ({ path }) => {
      const field = fieldName(path);
      return t`${field} has an invalid value`;
    }
  },
  string: {
    max: ({ path, max }) => {
      const field = fieldName(path);
      return t`${field} must be at most ${max} characters`;
    },
    url: ({ path }) => {
      const field = fieldName(path);
      return t`${field} must be a valid URL`;
    }
  }
});

export function resolveLocale(locale?: string): string {
  if (locale === "zh-CN" || locale === "zh-cn") return "zh";
  return locale === "en" || locale === "nb" || locale === "zh" ? locale : "zh";
}
