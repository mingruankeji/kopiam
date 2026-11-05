import enLocale from "dayjs/locale/en";
import nbLocale from "dayjs/locale/nb";
import nnLocale from "dayjs/locale/nn";
import zhCNLocale from "dayjs/locale/zh-cn";

const formats: Record<string, ILocale> = {
  en: enLocale,
  nb: nbLocale,
  nn: nnLocale,
  zh: zhCNLocale
};

export default formats;
