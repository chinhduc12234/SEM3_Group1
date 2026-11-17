import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import { api } from "@/shared/api/api";
import type { PageResult } from "@/shared/api/pagination";
import type { Campaign, CampaignAssignmentInput } from "../../types/campaigns";
import { getCampaignRouteStops, parseSubmissionDetails, sortSchedules } from "../../types/submission";
import type { CampaignReviewDecision, CampaignRow } from "../campaignManagement";
import { useCampaignImagePreviews } from "./useCampaignImagePreviews";

export function useCampaignManagement(createPage: boolean, campaignId?: string) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const linkedCampaign = useSearchParams().get("campaign");
  const campaignsPath = `/organizations/${id}/manage/campaigns`;
  const { data } = useWorkspace();
  const { user } = useAuth();
  const manager = data.roles.includes("CAMPAIGN_MANAGER");
  const owner = data.roles.includes("OWNER");
  const canList = owner || manager;
  const canViewDetails = canList || data.roles.some((role) => ["VOLUNTEER_COORDINATOR", "FINANCE_MANAGER"].includes(role));
  const operations = data.roles.includes("VOLUNTEER_COORDINATOR");
  const finance = data.roles.includes("FINANCE_MANAGER");
  const actorId = user?.id;
  const [rows, setRows] = useState<PageResult<CampaignRow> | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(createPage);
  const [editingSelected, setEditingSelected] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const mediaPreviews = useCampaignImagePreviews(creating ? null : selected);
  const pageSize = 5;
  const load = useCallback(async (signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) query.set("search", search.trim());
    if (statusFilter !== "ALL") query.set("status", statusFilter);
    if (typeFilter !== "ALL") query.set("campaignType", typeFilter);
    if (assignedOnly) query.set("assigned", "true");
    const result = await api<PageResult<CampaignRow>>(
      `/api/campaigns/organization/${id}?${query}`, { signal },
    );
    if (!signal?.aborted) setRows(result);
  }, [id, page, search, statusFilter, typeFilter, assignedOnly]);

  useEffect(() => {
    if (createPage || campaignId || linkedCampaign || !canList) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      load(controller.signal).catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [createPage, campaignId, linkedCampaign, load, canList]);

  useEffect(() => {
    if (!createPage && !campaignId && canViewDetails && linkedCampaign) {
      // Existing notifications use a campaign query parameter.
      if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(linkedCampaign)) router.replace(`${campaignsPath}/${linkedCampaign}`);
      else setError("Mã hồ sơ không hợp lệ.");
    }
  }, [canViewDetails, createPage, campaignId, linkedCampaign, campaignsPath, router]);

  useEffect(() => {
    if (!canViewDetails || !campaignId) return;
    const controller = new AbortController();
    api<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}/manage`, { signal: controller.signal })
      .then((campaign) => {
        if (controller.signal.aborted) return;
        if (campaign.organizationId !== id) throw new Error("Hồ sơ không thuộc tổ chức này.");
        setSelected(campaign);
      })
      .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [canViewDetails, campaignId, id]);

  async function action(work: () => Promise<void>, refresh = true) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      if (refresh && !createPage && !campaignId) await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const loadCampaign = (campaignId: string) => api<Campaign>(`/api/campaigns/${campaignId}/manage`);

  function openWizardForEdit(campaign: Campaign) {
    setSelected(campaign);
    setCreating(true);
    setEditingSelected(false);
    setError("");
    setMessage("");
  }

  function editCampaign(campaignId: string) {
    return action(async () => {
      const campaign = await loadCampaign(campaignId);
      if (campaign.status === "PUBLISHED") {
        setSelected(campaign);
        setEditingSelected(true);
      } else {
        openWizardForEdit(campaign);
      }
    }, false);
  }

  function deleteCampaign(campaignId: string) {
    return action(async () => {
      const campaign = await loadCampaign(campaignId);
      await api<void>(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
        body: JSON.stringify({ version: campaign.version }),
      });
      if (selected?.id === campaignId) setSelected(null);
      if (rows?.items.length === 1 && page > 1) setPage(page - 1);
    });
  }

  function reviewCampaign(decision: CampaignReviewDecision) {
    if (!selected) return;
    return action(async () => {
      const reviewed = await api<Campaign>(`/api/campaigns/${selected.id}/review`, {
        method: "POST",
        body: JSON.stringify({ version: selected.version, decision, note }),
      });
      setSelected(reviewed);
      setNote("");
      if (reviewed.status === "CONCEPT_APPROVED") {
        setMessage("Đã chấp thuận chủ trương. Hãy phân công người phụ trách.");
      } else {
        setMessage("Đã lưu kết quả duyệt ý tưởng.");
      }
    });
  }

  function assignCampaign(assignments: CampaignAssignmentInput[]) {
    if (!selected) return;
    return action(async () => {
      setSelected(await api<Campaign>(`/api/campaigns/${selected.id}/assignments`, {
        method: "PUT",
        body: JSON.stringify({ version: selected.version, assignments }),
      }));
      setMessage("Đã lưu phân công.");
    });
  }

  async function finishDraft(campaign: Campaign, submitted: boolean) {
    if (!createPage && !campaignId) {
      router.push(`${campaignsPath}/${campaign.id}`);
      return;
    }
    setSelected(campaign);
    setCreating(false);
    setMessage(submitted ? "Đã gửi ý tưởng cho Owner xét duyệt." : "Đã lưu bản nháp.");
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !publishedEditable) return;
    const values = new FormData(e.currentTarget);
    await action(async () => {
      setSelected(await api<Campaign>(`/api/campaigns/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...selected,
          title: values.get("title"),
          description: values.get("description"),
        }),
      }));
      setEditingSelected(false);
      setMessage("Đã cập nhật nội dung chiến dịch công khai.");
    });
  }

  const publishedEditable = manager && selected?.status === "PUBLISHED" && !selected.finalSubmissionId;
  const canReviewSelected = owner && !!selected && selected.createdBy !== actorId &&
    ["PENDING_REVIEW", "PENDING_CONCEPT_APPROVAL"].includes(selected.status);
  const submittedDetails = selected ? parseSubmissionDetails(selected.additionalDetails) : null;
  const submittedSchedules = sortSchedules(submittedDetails?.schedules ?? []);
  const submittedStops = getCampaignRouteStops(submittedSchedules);

  return {
    action, actorId, assignedOnly, setAssignedOnly, assignCampaign, canList, canViewDetails, busy, canReviewSelected, creating, editingSelected, error, id, manager, operations, finance,
    campaignsPath, linkedCampaign, mediaPreviews, message, note, editCampaign, deleteCampaign, reviewCampaign,
    finishDraft, owner, page, pageSize, publishedEditable, router, rows, save,
    search, selected, setBusy, setCreating, setEditingSelected,
    setMessage, setNote, setPage, setSearch, setSelected, setStatusFilter, statusFilter, setTypeFilter, typeFilter,
    submittedDetails, submittedSchedules, submittedStops,
  };
}

export type CampaignManagementModel = ReturnType<typeof useCampaignManagement>;
