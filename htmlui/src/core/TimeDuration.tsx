import dayjs from "dayjs";
import durationPlugin from "dayjs/plugin/duration";
import { useAppContext } from "./context/AppContext";

dayjs.extend(durationPlugin);

type Props = {
  from: string;
  to: string;
  format?: string;
};

export default function TimeDuration({ from, to, format = "H[h] m[m] s[s] SSS[ms]" }: Props) {
  const { locale } = useAppContext();
  const startDate = dayjs(from);
  const endDate = dayjs(to);
  const durDiff = dayjs.duration(endDate.diff(startDate));
  let formatted = durDiff.format(format);

  if (formatted.includes("0h ")) formatted = formatted.replace("0h ", "");
  if (formatted.includes("0m ")) formatted = formatted.replace("0m ", "");
  if (formatted.includes("0s ")) formatted = formatted.replace("0s ", "");
  if (locale === "zh") {
    formatted = formatted
      .replace(/ms\b/g, "毫秒")
      .replace(/h\b/g, "小时")
      .replace(/m\b/g, "分钟")
      .replace(/s\b/g, "秒");
  }
  return formatted;
}
