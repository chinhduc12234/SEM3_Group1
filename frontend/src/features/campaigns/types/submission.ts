export type SubmissionActivity = {
  id: number;
  start: string;
  end: string;
  detail: string;
  ward: string;
  address: string;
};
export type SubmissionSchedule = {
  id: number;
  title: string;
  description: string;
  date: string;
  activities: SubmissionActivity[];
};
export type CampaignSubmissionDetails = {
  province?: string;
  expenses?: { id?: number; name: string; amount: string | number; description: string }[];
  methods?: string[];
  bank?: { name?: string; otherName?: string; accountHolder?: string; accountNumber?: string };
  goods?: { description?: string; target?: string; address?: string };
  transparencyCommitment?: string;
  volunteers?: {
    count?: string;
    health?: string;
    skills?: string;
    description?: string;
    templateName?: string;
  };
  schedules?: SubmissionSchedule[];
  evidenceFiles?: string[];
  galleryFiles?: string[];
};
export function parseSubmissionDetails(value?: string): CampaignSubmissionDetails | null {
  try {
    const details = JSON.parse(value || "{}") as CampaignSubmissionDetails | null;
    if (!details || typeof details !== "object" || Array.isArray(details)) return null;
    if (Array.isArray(details.schedules)) {
      details.schedules = details.schedules.map((schedule, day) => ({
        id: schedule.id ?? day + 1,
        title: schedule.title ?? "",
        description: schedule.description ?? "",
        date: schedule.date ?? "",
        activities: (schedule.activities ?? []).map((activity, index) => ({
          id: activity.id ?? index + 1,
          start: activity.start ?? "",
          end: activity.end ?? "",
          detail: activity.detail ?? "",
          ward: activity.ward ?? "",
          address: activity.address ?? "",
        })),
      }));
    }
    return details;
  } catch {
    return null;
  }
}

export function sortSchedules(schedules: SubmissionSchedule[]) {
  return [...schedules].sort((a, b) => a.date.localeCompare(b.date));
}

export function getCampaignRouteStops(schedules: SubmissionSchedule[]) {
  return sortSchedules(schedules).flatMap((schedule, day) =>
    [...(schedule.activities ?? [])]
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((activity, index) => ({
        date: schedule.date,
        start: activity.start,
        ward: activity.ward,
        detail: activity.detail,
        day: day + 1,
        activity: index + 1,
      }))
      .filter((stop) => stop.ward),
  );
}
