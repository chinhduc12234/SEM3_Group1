import type { RouteStop } from "../../components/itinerary/CampaignRouteMap";
import type { Campaign } from "../../types/campaigns";
import { formatCampaignDate } from "../../formatCampaignDate";
import type { OperationsView } from "./operationsTypes";

export function operationsRouteStops(days: OperationsView["plan"]["days"], campaign: Campaign): RouteStop[] {
  return days.flatMap((day, index) => {
    const hasCampaignLocation = Boolean(day.location && day.location === campaign.location);
    const address = day.address ?? (hasCampaignLocation ? campaign.concept?.plannedAddress : null);
    if (!day.mapPin && !address?.ward && (!day.location || campaign.concept?.eventFormat === "ONLINE")) return [];
    return [{
      date: day.date ? formatCampaignDate(day.date) : "",
      start: "",
      ward: address?.ward?.name ?? "",
      province: address?.province?.name,
      district: address?.district?.name,
      detail: day.location,
      title: day.title || "Địa điểm triển khai",
      schedule: [...day.activities].sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
        .map((activity) => [[activity.start?.slice(0, 5), activity.end?.slice(0, 5)].filter(Boolean).join(" – "), activity.title]
          .filter(Boolean).join(" · ")),
      day: index + 1,
      activity: 0,
      pin: day.mapPin,
    }];
  });
}
