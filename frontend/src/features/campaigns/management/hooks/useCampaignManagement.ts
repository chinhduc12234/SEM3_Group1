import {
  type SubmissionSchedule,
  parseSubmissionDetails,
  getCampaignRouteStops,
  sortSchedules,
} from "@/features/campaigns/types/submission";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from "@/features/organizations/workspace/WorkspaceContext";
import { api } from "@/shared/api/api";
import { type Campaign, causes } from "@/features/campaigns/types/campaigns";
import type { PageResult } from "@/shared/api/pagination";
import {
  type CampaignRow,
  type CampaignReviewDecision,
  getCampaignScheduleRange,
} from "../campaignManagement";

import { useCampaignLookups } from "./useCampaignLookups";
import { useCampaignImagePreviews } from "./useCampaignImagePreviews";

export function useCampaignManagement(createPage: boolean) {
  const [review, setReview] = useState<Record<string, string>>({});
  const [scheduleError, setScheduleError] = useState("");
  const [schedules, setSchedules] = useState<SubmissionSchedule[]>([]);
  const [cover, setCover] = useState<File | null>(null),
    [evidence, setEvidence] = useState<File[]>([]),
    [gallery, setGallery] = useState<File[]>([]),
    [imageError, setImageError] = useState("");
  const [imageChecking, setImageChecking] = useState(false);
  const [startDate, setStartDate] = useState(""),
    [endDate, setEndDate] = useState(""),
    [volunteerFile, setVolunteerFile] = useState<File | null>(null),
    [volunteerFileError, setVolunteerFileError] = useState("");
  const [province, setProvince] = useState("");

  const [otherBank, setOtherBank] = useState(false),
    [selectedBank, setSelectedBank] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [expenses, setExpenses] = useState([{ id: 0, name: "", amount: "", description: "" }]),
    [methods, setMethods] = useState<string[]>([]),
    [existingEvidenceFiles, setExistingEvidenceFiles] = useState<string[]>([]),
    [existingGalleryFiles, setExistingGalleryFiles] = useState<string[]>([]);
  const [step, setStep] = useState(1);

  const { scheduleLimit, lastScheduleDate } = getCampaignScheduleRange(startDate, endDate);
  const routeStops = getCampaignRouteStops(schedules);
  const {
    banks,
    bankStatus,
    provinces,
    provinceError,
    wards,
    wardStatus,
    setBankRetry,
    setWardRetry,
  } = useCampaignLookups(province, methods.includes("Chuyển khoản ngân hàng"), step);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data } = useWorkspace();
  const manager = data.roles.includes("CAMPAIGN_MANAGER"),
    owner = data.roles.includes("OWNER");
  const [rows, setRows] = useState<PageResult<CampaignRow> | null>(null),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Campaign | null>(null),
    [creating, setCreating] = useState(createPage),
    [viewing, setViewing] = useState(false),
    [editingSelected, setEditingSelected] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState("ALL");
  const { imagePreviews, mediaPreviews } = useCampaignImagePreviews(
    cover,
    evidence,
    gallery,
    selected,
  );
  const [draftCampaign, setDraftCampaign] = useState<Campaign | null>(null),
    [uploadedCampaignFiles, setUploadedCampaignFiles] = useState<string[]>([]);
  const pageSize = 5;
  const load = useCallback(
    async () =>
      setRows(
        await api<PageResult<CampaignRow>>(
          `/api/campaigns/organization/${id}?page=${page}&pageSize=${pageSize}`,
        ),
      ),
    [id, page],
  );
  useEffect(() => {
    if (manager || owner) load().catch((e) => setError(e.message));
  }, [load, manager, owner]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function openWizardForEdit(campaign: Campaign) {
    const details = parseSubmissionDetails(campaign.additionalDetails) || {};
    const bank = details.bank || {};
    setSelected(campaign);
    setDraftCampaign(campaign);
    setUploadedCampaignFiles([]);
    setCreating(true);
    setViewing(false);
    setEditingSelected(false);
    setStep(1);
    setStartDate(campaign.startDate);
    setEndDate(campaign.endDate);
    setProvince(details.province || campaign.location);
    setSchedules(details.schedules ?? []);
    setExpenses(
      details.expenses?.length
        ? details.expenses.map((item, index) => ({
            id: item.id ?? index,
            name: item.name || "",
            amount: String(item.amount ?? ""),
            description: item.description || "",
          }))
        : [{ id: 0, name: "", amount: "", description: "" }],
    );
    setMethods(details.methods || []);
    setExistingEvidenceFiles(details.evidenceFiles || []);
    setExistingGalleryFiles(details.galleryFiles || []);
    setSelectedBank(bank.name || "");
    setOtherBank(bank.name === "Ngân hàng khác");
    setBankSearch("");
    setReview({
      title: campaign.title,
      description: campaign.description,
      cause: campaign.cause,
      contactEmail: campaign.contactEmail,
      contactPhone: campaign.contactPhone,
      bankName: bank.name || "",
      otherBankName: bank.otherName || "",
      bankAccountHolder: bank.accountHolder || "",
      bankAccountNumber: bank.accountNumber || "",
      goodsDescription: details.goods?.description || "",
      goodsTarget: details.goods?.target || "",
      goodsAddress: details.goods?.address || "",
      transparencyCommitment: details.transparencyCommitment || "",
      volunteerCount: details.volunteers?.count || String(campaign.volunteerTarget),
      volunteerHealth: details.volunteers?.health || "",
      volunteerSkills: details.volunteers?.skills || "",
      volunteerDescription: details.volunteers?.description || "",
    });
    setCover(null);
    setEvidence([]);
    setGallery([]);
    setVolunteerFile(null);
    setVolunteerFileError("");
    setImageError("");
    setScheduleError("");
    setError("");
    setMessage("");
  }
  const loadCampaign = (campaignId: string) => api<Campaign>(`/api/campaigns/${campaignId}/manage`);

  function editCampaign(campaignId: string) {
    return action(async () => openWizardForEdit(await loadCampaign(campaignId)));
  }

  function viewCampaign(campaignId: string) {
    return action(async () => {
      openWizardForEdit(await loadCampaign(campaignId));
      setViewing(true);
      setNote("");
    });
  }

  function deleteCampaign(campaignId: string) {
    return action(async () => {
      const campaign = await loadCampaign(campaignId);
      await api<void>(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
        body: JSON.stringify({ version: campaign.version }),
      });
    });
  }

  function reviewCampaign(decision: CampaignReviewDecision) {
    if (!selected) return;
    return action(async () => {
      setSelected(
        await api<Campaign>(`/api/campaigns/${selected.id}/review`, {
          method: "POST",
          body: JSON.stringify({ version: selected.version, decision, note }),
        }),
      );
      setMessage("Đã lưu kết quả xét duyệt.");
    });
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const body = {
        ...selected,
        ...Object.fromEntries(f),
        ...(creating ? { beneficiaryDescription: causes[String(f.get("cause"))] } : {}),
        organizationId: id,
        campaignType: "COMBINED",
        goalAmount: Number(f.get("goalAmount")),
        volunteerTarget: Number(f.get("volunteerTarget")),
        version: selected?.version || "",
      };
      setSelected(
        await api<Campaign>(selected ? `/api/campaigns/${selected.id}` : "/api/campaigns", {
          method: selected ? "PUT" : "POST",
          body: JSON.stringify(body),
        }),
      );
      setCreating(false);
      setEditingSelected(false);
      setMessage(
        selected?.status === "PUBLISHED"
          ? "Đã cập nhật nội dung chiến dịch công khai."
          : "Đã lưu bản nháp. Gửi Owner duyệt khi đã kiểm tra thông tin.",
      );
    });
  }
  async function submitCampaign(form: HTMLFormElement) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const values = new FormData(form);
      const details = {
        expenses,
        methods,
        bank: {
          name: String(values.get("bankName") || ""),
          otherName: String(values.get("otherBankName") || ""),
          accountHolder: String(values.get("bankAccountHolder") || ""),
          accountNumber: String(values.get("bankAccountNumber") || ""),
        },
        goods: {
          description: String(values.get("goodsDescription") || ""),
          target: String(values.get("goodsTarget") || ""),
          address: String(values.get("goodsAddress") || ""),
        },
        transparencyCommitment: String(values.get("transparencyCommitment") || ""),
        volunteers: {
          count: String(values.get("volunteerCount") || ""),
          health: String(values.get("volunteerHealth") || ""),
          skills: String(values.get("volunteerSkills") || ""),
          description: String(values.get("volunteerDescription") || ""),
          templateName:
            volunteerFile?.name ||
            selected?.media.find((media) => media.kind === "DOCUMENT")?.fileName ||
            "",
        },
        schedules,
        province,
        evidenceFiles: [...existingEvidenceFiles, ...evidence.map((file) => file.name)],
        galleryFiles: [...existingGalleryFiles, ...gallery.map((file) => file.name)],
      };
      const cause = String(values.get("cause") || "");
      const description = String(values.get("description") || "").trim();
      if (description.length < 30) {
        setStep(1);
        throw new Error("Mô tả chiến dịch cần có ít nhất 30 ký tự.");
      }
      const beneficiaryDescription = `${causes[cause] || "Cộng đồng"} là nhóm thụ hưởng chính của chiến dịch.`;
      const body = {
        organizationId: id,
        title: String(values.get("title") || "").trim(),
        description,
        campaignType: "COMBINED",
        cause,
        beneficiaryDescription,
        goalAmount: expenses.reduce((total, item) => total + (Number(item.amount) || 0), 0),
        volunteerTarget: Number(values.get("volunteerCount") || 0),
        startDate,
        endDate,
        location: province,
        contactEmail: String(values.get("contactEmail") || ""),
        contactPhone: String(values.get("contactPhone") || ""),
        additionalDetails: JSON.stringify(details),
      };
      let campaign = draftCampaign || (creating ? selected : null);
      if (!campaign) {
        campaign = await api<Campaign>("/api/campaigns", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setDraftCampaign(campaign);
      } else {
        campaign = await api<Campaign>("/api/campaigns/" + campaign.id, {
          method: "PUT",
          body: JSON.stringify({ ...body, version: campaign.version }),
        });
        setDraftCampaign(campaign);
      }
      const uploads: { file: File; kind: string; replaceId?: string }[] = [
        ...(cover ? [{ file: cover, kind: "COVER" }] : []),
        ...evidence.map((file) => ({ file, kind: "GALLERY" })),
        ...gallery.map((file) => ({ file, kind: "GALLERY" })),
        ...(volunteerFile
          ? [
              {
                file: volunteerFile,
                kind: "DOCUMENT",
                replaceId: selected?.media.find((media) => media.kind === "DOCUMENT")?.id,
              },
            ]
          : []),
      ];
      for (const item of uploads) {
        const fingerprint = [
          item.kind,
          item.file.name,
          item.file.size,
          item.file.lastModified,
        ].join(":");
        if (uploadedCampaignFiles.includes(fingerprint)) continue;
        const upload = new FormData();
        upload.append("version", campaign.version);
        upload.append("kind", item.kind);
        if (item.replaceId) upload.append("replaceId", item.replaceId);
        upload.append("file", item.file);
        campaign = await api<Campaign>("/api/campaigns/" + campaign.id + "/media", {
          method: "POST",
          body: upload,
        });
        setDraftCampaign(campaign);
        setUploadedCampaignFiles((items) => [...items, fingerprint]);
      }
      const editingPending = campaign.status === "PENDING_REVIEW";
      if (!editingPending)
        campaign = await api<Campaign>("/api/campaigns/" + campaign.id + "/submit", {
          method: "POST",
          body: JSON.stringify({ version: campaign.version }),
        });
      setSelected(campaign);
      setDraftCampaign(null);
      setUploadedCampaignFiles([]);
      setCreating(false);
      setMessage(
        editingPending
          ? "Đã cập nhật nội dung và tệp của chiến dịch đang chờ Owner duyệt."
          : "Đã gửi chiến dịch cho Owner xét duyệt.",
      );
      await load();
    } catch (ex) {
      setError((ex as Error).message || "Không thể gửi chiến dịch.");
    } finally {
      setBusy(false);
    }
  }
  const publishedEditable = manager && selected?.status === "PUBLISHED";
  const editable =
    manager &&
    (!selected || ["DRAFT", "NEEDS_REVISION", "PENDING_REVIEW"].includes(selected.status));
  const selectedCanEdit = !!selected && (editable || publishedEditable);
  const canReviewSelected = owner && selected?.status === "PENDING_REVIEW";
  const submittedDetails = selected ? parseSubmissionDetails(selected.additionalDetails) : null;
  const submittedSchedules = sortSchedules(submittedDetails?.schedules ?? []);
  const submittedStops = getCampaignRouteStops(submittedSchedules);
  return {
    action,
    bankSearch,
    bankStatus,
    banks,
    busy,
    canReviewSelected,
    cover,
    creating,
    editable,
    editingSelected,
    endDate,
    error,
    evidence,
    existingEvidenceFiles,
    existingGalleryFiles,
    expenses,
    gallery,
    id,
    imageChecking,
    imageError,
    imagePreviews,
    lastScheduleDate,
    manager,
    mediaPreviews,
    message,
    methods,
    note,
    viewCampaign,
    editCampaign,
    deleteCampaign,
    reviewCampaign,
    openWizardForEdit,
    otherBank,
    owner,
    page,
    pageSize,
    province,
    provinceError,
    provinces,
    publishedEditable,
    review,
    routeStops,
    router,
    rows,
    save,
    scheduleError,
    scheduleLimit,
    schedules,
    search,
    selected,
    selectedBank,
    selectedCanEdit,
    setBankRetry,
    setBankSearch,
    setCover,
    setCreating,
    setEditingSelected,
    setEndDate,
    setEvidence,
    setExpenses,
    setGallery,
    setImageChecking,
    setImageError,
    setMessage,
    setMethods,
    setNote,
    setOtherBank,
    setPage,
    setProvince,
    setReview,
    setScheduleError,
    setSchedules,
    setSearch,
    setSelected,
    setSelectedBank,
    setStartDate,
    setStatusFilter,
    setStep,
    setViewing,
    setVolunteerFile,
    setVolunteerFileError,
    setWardRetry,
    startDate,
    statusFilter,
    step,
    submitCampaign,
    submittedDetails,
    submittedSchedules,
    submittedStops,
    viewing,
    volunteerFile,
    volunteerFileError,
    wardStatus,
    wards,
  };
}

export type CampaignManagementModel = ReturnType<typeof useCampaignManagement>;
