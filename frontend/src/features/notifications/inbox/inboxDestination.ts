import type { InboxItem } from "../types";

export function inboxDestination(item: InboxItem) {
  const { url, kind } = item;
  if (/^\/(?:admin\/)?organizations\/[0-9a-f-]+(?:\/manage)?$/.test(url)) return url;
  if (kind === "CAMPAIGN_ASSIGNED" && /^\/organizations\/[0-9a-f-]{36}\/manage\/campaigns\?campaign=[0-9a-f-]{36}$/.test(url)) return url;
  if (kind === "ACTIVITY_PHOTO_REPORT" && /^\/organizations\/[0-9a-f-]{36}\/manage\/campaigns\/[0-9a-f-]{36}\?tab=operations#activity-reports$/.test(url)) return url;
  if (kind === "CAMPAIGN_STARTED" && /^\/organizations\/[0-9a-f-]{36}\/manage\/campaigns\/[0-9a-f-]{36}\/readiness$/.test(url)) return url;
  if (kind === "CAMPAIGN_SCHEDULE_CHANGED" && /^\/chien-dich\/[0-9a-f-]{36}$/.test(url)) return url;
  if (kind === "VOLUNTEER_REGISTRATION_REMOVED" && /^\/account\/history\?removal=[0-9a-f-]{36}$/.test(url)) return url;
  if (kind.startsWith("VOLUNTEER_REGISTRATION_")) {
    if (/^\/account\/history\?registration=[0-9a-f-]{36}$/.test(url) ||
        /^\/organizations\/[0-9a-f-]{36}\/manage\/volunteers\/[0-9a-f-]{36}$/.test(url)) return url;
    if (/^\/organizations\/[0-9a-f-]{36}\/manage\/operations\/[0-9a-f-]{36}$/.test(url))
      return url.replace("/manage/operations/", "/manage/volunteers/");
  }
  if ((kind.startsWith("IN_KIND_PLEDGE_") || kind === "DONATION_CONFIRMED" || kind === "FUNDRAISING_GOAL_REACHED") && (
    /^\/account\/payments\?(?:pledge|payment)=[0-9a-f-]{36}$/.test(url) ||
    /^\/organizations\/[0-9a-f-]{36}\/manage\/budget\/[0-9a-f-]{36}$/.test(url))) return url;
  return null;
}
