import { en } from "./messages.en";

export type Locale = "vi" | "en";

export function translateText(text: string, locale: Locale) {
  if (locale !== "en") return text;
  const trimmed = text.trim();
  const translated = en[trimmed];
  let result = translated;
  if (result === undefined && trimmed.includes(" · "))
    result = trimmed
      .split(" · ")
      .map((part) => en[part] ?? part)
      .join(" · ");
  if (result === undefined) {
    const notificationMessage = trimmed.match(
      /^(.+)\. Mở hồ sơ để xem chi tiết và hướng dẫn xử lý\.$/,
    );
    const uploadError = trimmed.match(
      /^Tệp vượt dung lượng cho phép \((\d+(?:\.\d+)?) MB\) hoặc rỗng\.$/,
    );
    if (notificationMessage)
      result = `${notificationMessage[1]}. Open the profile for details and next steps.`;
    else if (uploadError)
      result = `The file is empty or exceeds the ${uploadError[1]} MB size limit.`;
  }
  if (result === undefined) {
    const page = trimmed.match(/^Trang (\d+)(?: \/ (\d+))?$/);
    const unread = trimmed.match(/^(\d+) chưa đọc$/);
    const campaignCount = trimmed.match(/^(\d+) chiến dịch$/);
    const profileCount = trimmed.match(/^(\d+) hồ sơ$/);
    const localizedDate = trimmed.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:, (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    const localizedTime = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    const groupedNumber = trimmed.match(/^(\d{1,3})(\.\d{3})+(,\d+)?$/);
    if (page) result = `Page ${page[1]}${page[2] ? ` / ${page[2]}` : ""}`;
    else if (unread) result = `${unread[1]} unread`;
    else if (campaignCount) result = `${campaignCount[1]} campaigns`;
    else if (profileCount) result = `${Number(profileCount[1]).toLocaleString("en-US")} records`;
    else if (localizedDate) {
      const [, day, month, year, hour, minute, second] = localizedDate;
      const date = `${Number(month)}/${Number(day)}/${year}`;
      if (hour === undefined) result = date;
      else {
        const dateTime = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second || 0),
        );
        result = `${date}, ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", ...(second ? { second: "2-digit" } : {}), hour12: true }).format(dateTime)}`;
      }
    } else if (localizedTime) {
      const dateTime = new Date();
      dateTime.setHours(Number(localizedTime[1]), Number(localizedTime[2]), 0, 0);
      result = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(dateTime);
    } else if (groupedNumber) {
      const [whole, fraction] = trimmed.split(",");
      result = whole.replace(/\./g, ",") + (fraction ? `.${fraction}` : "");
    }
  }
  if (result === undefined) return text;
  const start = text.match(/^\s*/)?.[0] ?? "";
  const end = text.match(/\s*$/)?.[0] ?? "";
  return `${start}${result}${end}`;
}
