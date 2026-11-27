import type { PlannedCampaignAddress } from "../../types/campaigns";
import type { RouteStop } from "../../components/itinerary/CampaignRouteMap";

export type Member = { userId: string; fullName: string; canLeadTeam: boolean };
export type Attendance = { staffConfirmed: number; staffPresent: number; volunteersConfirmed: number; volunteersPresent: number };
export type Activity = {
  id: string; title: string; start: string | null; end: string | null; location: string;
  tasks: string; leadUserId: string | null; staffNeeded: number; volunteersNeeded: number; teamIds: string[];
  backupUserId?: string | null; attendance?: Attendance | null;
};
export type Day = {
  id: string; date: string | null; title: string; objective: string; description: string;
  location: string; leadUserId: string | null; notes: string; activities: Activity[];
  activitiesDone?: boolean; extraReason?: string | null; extraApprovedAt?: string | null;
  address?: PlannedCampaignAddress | null; mapPin?: RouteStop["pin"];
};
export type Team = {
  id: string; name: string; duties: string; leadUserId: string | null; staffNeeded: number;
  volunteersNeeded: number; volunteerSkills: string; staffUserIds: string[];
};
export type VolunteerGroup = {
  id: string; name: string; categoryId: string; volunteerCount: number;
  dayId: string | null; activityId: string | null; teamId: string | null; notes: string;
  isPriority?: boolean; requiresReview?: boolean; minimumConfirmed?: number | null;
};
export type Plan = { days: Day[]; teams: Team[]; resources: unknown[]; volunteerGroups: VolunteerGroup[] };
export type OperationsView = {
  version: string; plan: Plan; confirmedAt: string | null; canEdit: boolean; members: Member[];
  confirmedByName: string | null;
  canRecordAttendance: boolean;
  canApproveExtraDays: boolean; hasAutomaticCalendar: boolean;
  volunteerGroupCategories: { id: string; name: string }[];
};
export type OperationsTab = "days" | "activities" | "teams" | "volunteerGroups" | "route" | "attendance";

export type EditPlan = (change: (current: Plan) => Plan) => void;
