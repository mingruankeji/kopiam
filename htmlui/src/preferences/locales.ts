import { CN, type FlagComponent, NO, US } from "country-flag-icons/react/3x2";

const supportedLocales: Record<string, { name: string; cc: string; flag: FlagComponent }> = {
  en: {
    name: "English",
    cc: "US",
    flag: US
  },
  nb: {
    name: "Norsk - Bokmål",
    cc: "NO",
    flag: NO
  },
  zh: {
    name: "简体中文",
    cc: "CN",
    flag: CN
  }
};

export default supportedLocales;
