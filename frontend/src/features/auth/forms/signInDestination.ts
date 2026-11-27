import { api } from "@/shared/api/api";

type WorkspaceMembership = { id: string; roles?: string[] };

export function isPublicReturnPath(path: string) {
  return /^\/chien-dich\/[a-f0-9-]{36}\?tham-gia=(ung-ho(&donation=[a-f0-9-]{36})?|hien-vat)$/i.test(path) ||
    /^\/account\/(history(\?(registration|removal)=[a-f0-9-]{36})?|payments(\?(payment|pledge)=[a-f0-9-]{36})?)$/i.test(path);
}

export function matchWorkspaceReturnPath(path: string | null) {
  return path?.match(
    /^\/organizations\/([a-f0-9-]{36})\/manage\/(campaigns\/[a-f0-9-]{36}\/readiness|field-work|work|volunteers(?:\/[a-f0-9-]{36})?)$/i,
  );
}

export async function getWorkspaceSignInDestination(returnTo: string | null, isAdmin: boolean, signal: AbortSignal) {
  const workspaceReturn = matchWorkspaceReturnPath(returnTo);
  const options = { signal };
  try {
    const memberships = await api<WorkspaceMembership[]>("/api/organizations/workspaces/mine", options);
    const requestedMembership = workspaceReturn && memberships.find((item) =>
      item.id.toLowerCase() === workspaceReturn[1].toLowerCase());
    if (returnTo && workspaceReturn && requestedMembership &&
      (!workspaceReturn[2].toLowerCase().startsWith("volunteers") || requestedMembership.roles?.includes("VOLUNTEER_COORDINATOR"))) {
      return returnTo;
    }
    if (!isAdmin && memberships.length === 1) {
      const membership = memberships[0];
      const memberOnly = membership.roles?.some((role) => ["STAFF", "SURVEY_STAFF"].includes(role)) &&
        !membership.roles?.some((role) => ["OWNER", "ORGANIZATION_MANAGER", "CAMPAIGN_MANAGER", "VOLUNTEER_COORDINATOR", "FINANCE_MANAGER"].includes(role));
      return `/organizations/${membership.id}/manage${memberOnly ? "/field-work" : ""}`;
    }
    if (!isAdmin && (memberships.length > 1 ||
      (await api<unknown[]>("/api/organizations/invitations/mine", options)).length > 0)) {
      return "/organizations/mine";
    }
  } catch {
    // Login remains usable when organization data is temporarily unavailable.
  }
  return isAdmin ? "/admin" : "/";
}
