import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api/api";
import { causes, type Campaign, type PlannedCampaignAddress } from "../types/campaigns";
import { conceptForm, conceptSteps, eventFormats, fieldsForStep, type ConceptForm } from "./campaignConceptFields";
import CampaignConceptSummary from "./components/CampaignConceptSummary";
import CampaignAddressFields from "./components/CampaignAddressFields";
import { useCampaignImagePreviews } from "./hooks/useCampaignImagePreviews";
import styles from "./CampaignManagement.module.css";
import wizard from "./CampaignWizard.module.css";

type ParentOption = { id: string; title: string };
type Props = {
  organizationId: string;
  draft: Campaign | null;
  onBusyChange: (busy: boolean) => void;
  onSaved: (campaign: Campaign, submitted: boolean) => Promise<void>;
};

const maxCampaignFiles = 13;
const maxImageBytes = 5 * 1024 * 1024;

function fileKey(name: string) {
  return name.slice(0, 200).toLowerCase();
}

function fieldValue(values: ConceptForm, key: keyof ConceptForm) {
  return values[key].trim();
}

export default function CampaignWizard({ organizationId, draft, onBusyChange, onSaved }: Props) {
  const [values, setValues] = useState(() => conceptForm(draft));
  const [address, setAddress] = useState<PlannedCampaignAddress>(() => draft?.concept?.plannedAddress ?? {
    mode: "CURRENT", province: null, district: null, ward: null, detail: "",
  });
  const [step, setStep] = useState(0);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [gallery, setGallery] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<{ file: File; url: string }[]>([]);
  const [document, setDocument] = useState<File | null>(null);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [parentError, setParentError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const savedDraft = useRef(draft);
  const [previewDraft, setPreviewDraft] = useState(draft);
  const storedPreviews = useCampaignImagePreviews(previewDraft);
  const saving = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const isEvent = values.campaignType === "EVENT";
  const isReview = step === conceptSteps.length;
  const titles = [...conceptSteps.map(({ title }) => title), "Xem lại và gửi duyệt"];
  const canAddPlatform = values.eventFormat === "ONLINE" || values.eventFormat === "HYBRID";
  const showAddress = !isEvent || values.eventFormat !== "ONLINE";
  const plannedAddress = showAddress && (address.province || address.detail?.trim()) ? address : null;
  const parentTitle = parents.find(({ id }) => id === values.parentCampaignId)?.title ?? draft?.parentCampaignTitle;

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!cover) {
      setCoverPreview("");
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  useEffect(() => {
    const previews = gallery.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setGalleryPreviews(previews);
    return () => previews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [gallery]);

  useEffect(() => {
    if (!isEvent) return;
    let active = true;
    setParentError("");
    api<ParentOption[]>(`/api/campaigns/organization/${organizationId}/parent-options`)
      .then((items) => { if (active) setParents(items); })
      .catch(() => { if (active) setParentError("Chưa tải được danh sách chiến dịch cha."); });
    return () => { active = false; };
  }, [organizationId, isEvent]);

  function change(key: keyof ConceptForm, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function chooseFile(kind: "COVER" | "DOCUMENT", input: HTMLInputElement) {
    const file = input.files?.[0] ?? null;
    const valid = !file || (file.size >= 8 && (
      kind === "COVER"
        ? /\.(png|jpe?g)$/i.test(file.name) && file.size <= 5 * 1024 * 1024
        : /\.(pdf|docx)$/i.test(file.name) && file.size <= 5 * 1024 * 1024
    ));
    if (!valid) {
      input.value = "";
      setError(kind === "COVER" ? "Chọn ảnh PNG hoặc JPG tối đa 5 MB." : "Chọn tài liệu PDF hoặc DOCX tối đa 5 MB.");
      return;
    }
    setError("");
    if (kind === "COVER") setCover(file);
    else setDocument(file);
  }

  function chooseGallery(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length) return;

    const invalid = files.find((file) => !/\.(png|jpe?g)$/i.test(file.name) ||
      file.size < 8 || file.size > maxImageBytes);
    if (invalid) {
      setError(`Ảnh “${invalid.name}” phải là PNG hoặc JPG và không vượt quá 5 MB.`);
      return;
    }
    const nextGallery = [...gallery, ...files];
    const error = uploadProblem(nextGallery);
    if (error) {
      setError(error);
      return;
    }
    setError("");
    setGallery(nextGallery);
  }

  function uploadProblem(images: File[]) {
    const stored = savedDraft.current?.media ?? [];
    const storedNames = stored.filter(({ kind }) => kind !== "COVER" || !cover);
    const names = [
      ...(cover ? [cover.name] : []),
      ...(document ? [document.name] : []),
      ...images.map(({ name }) => name),
    ];
    if (names.length && storedNames.length + names.length > maxCampaignFiles) {
      return "Mỗi hồ sơ có tối đa 13 tệp, gồm ảnh đại diện, ảnh phụ và tài liệu.";
    }
    const keys = new Set(storedNames.map(({ fileName }) => fileKey(fileName)));
    for (const name of names) {
      const key = fileKey(name);
      if (keys.has(key)) return `Tên tệp “${name}” bị trùng. Vui lòng đổi tên hoặc bỏ ảnh đã chọn.`;
      keys.add(key);
    }
    return "";
  }

  async function persist(submit: boolean) {
    if (saving.current) return;
    setError("");
    const attachmentError = uploadProblem(gallery);
    if (attachmentError) {
      setStep(0);
      setError(attachmentError);
      return;
    }
    if (submit) {
      for (const index of conceptSteps.keys()) {
        const missing = fieldsForStep(index, values).filter((field) => field.required && !fieldValue(values, field.key));
        if (missing.length || (index === 0 && (!values.cause || values.title.trim().length < 3))) {
          setStep(index);
          setError(index === 0
            ? "Nhập tên chương trình (ít nhất 3 ký tự), danh mục và mô tả ngắn."
            : `Vui lòng nhập ${missing.map(({ label }) => label.toLowerCase()).join(", ")}.`);
          return;
        }
      }
      if ((plannedAddress && (!address.province || !address.ward)) ||
          (!isEvent && !plannedAddress && !values.location.trim())) {
        setStep(3);
        setError("Chọn tỉnh/thành phố và phường/xã cho địa chỉ dự kiến. Với địa chỉ cũ, hãy chọn thêm quận/huyện.");
        return;
      }
    }
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      setStep(3);
      setError("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
      return;
    }
    if (isEvent && values.eventStartTime && values.eventEndTime &&
      !(values.startDate && values.endDate > values.startDate) && values.eventEndTime <= values.eventStartTime) {
      setStep(3);
      setError("Giờ kết thúc phải sau giờ bắt đầu. Nếu sự kiện qua đêm, hãy nhập cả hai ngày.");
      return;
    }
    const estimated = values.estimatedBeneficiaries ? Number(values.estimatedBeneficiaries) : null;
    if (estimated !== null && (!Number.isInteger(estimated) || estimated < 1 || estimated > 2147483647)) {
      setStep(2);
      setError("Số người dự kiến phải là số nguyên dương hợp lệ.");
      return;
    }
    const { title, description, beneficiaryDescription, cause, campaignType, location, startDate, endDate, contactEmail, contactPhone, ...idea } =
      Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])) as ConceptForm;
    const body = {
      organizationId, title, description, beneficiaryDescription, cause, campaignType, location, contactEmail, contactPhone,
      startDate: startDate || null, endDate: endDate || null,
      concept: {
        ...idea,
        estimatedBeneficiaries: estimated,
        eventFormat: isEvent ? idea.eventFormat || null : null,
        onlinePlatform: isEvent && canAddPlatform ? idea.onlinePlatform || null : null,
        eventStartTime: isEvent && idea.eventStartTime ? `${idea.eventStartTime}:00` : null,
        eventEndTime: isEvent && idea.eventEndTime ? `${idea.eventEndTime}:00` : null,
        plannedAddress,
        parentCampaignId: isEvent ? idea.parentCampaignId || null : null,
        timezone: draft?.concept?.timezone ?? "Asia/Ho_Chi_Minh",
      },
    };
    saving.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      const existing = savedDraft.current;
      let campaign = await api<Campaign>(existing ? `/api/campaigns/${existing.id}` : "/api/campaigns", {
        method: existing ? "PUT" : "POST",
        body: JSON.stringify({ ...body, version: existing?.version ?? "" }),
      });
      savedDraft.current = campaign;
      const uploads = [
        ["COVER", cover],
        ["DOCUMENT", document],
        ...gallery.map((file) => ["GALLERY", file] as const),
      ] as const;
      for (const [kind, file] of uploads) {
        if (!file) continue;
        const upload = new FormData();
        upload.set("kind", kind);
        upload.set("version", campaign.version);
        upload.set("file", file);
        try {
          campaign = await api<Campaign>(`/api/campaigns/${campaign.id}/media`, { method: "POST", body: upload });
        } catch (error) {
          setStep(0);
          throw new Error(`Không tải được “${file.name}”. ${(error as Error).message}`);
        }
        savedDraft.current = campaign;
        if (kind === "COVER") setCover(null);
        else if (kind === "DOCUMENT") setDocument(null);
        else setGallery((current) => current.filter((item) => item !== file));
      }
      if (submit) {
        campaign = await api<Campaign>(`/api/campaigns/${campaign.id}/submit`, {
          method: "POST",
          body: JSON.stringify({ version: campaign.version }),
        });
        savedDraft.current = campaign;
      }
      await onSaved(campaign, submit);
    } catch (e) {
      setPreviewDraft(savedDraft.current);
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  const storedCover = savedDraft.current?.media.find(({ kind }) => kind === "COVER");
  const storedGallery = savedDraft.current?.media.filter(({ kind }) => kind === "GALLERY") ?? [];
  const coverName = cover?.name ?? storedCover?.fileName;
  const documentNames = [
    ...(savedDraft.current?.media.filter(({ kind }) => kind === "DOCUMENT").map(({ fileName }) => fileName) ?? []),
    ...(document ? [document.name] : []),
  ];
  const displayedCoverUrl = cover ? coverPreview : storedCover && storedPreviews[storedCover.id]?.url;

  return (
    <div className={wizard.layout}>
      <nav className={wizard.navigation} aria-label="Các bước tạo bản nháp">
        <div className={wizard.progressHeading}>
          <strong>Bước {step + 1} / {titles.length}</strong>
          <progress aria-label="Vị trí trong biểu mẫu" value={step + 1} max={titles.length} />
        </div>
        <ol>
          {titles.map((title, index) => (
            <li key={title}>
              <button type="button" className="quiet" aria-current={step === index ? "step" : undefined} disabled={busy} onClick={() => setStep(index)}>
                <span className={wizard.stepNumber}>{index + 1}</span><span>{title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <fieldset className={`${styles.conceptForm} ${wizard.card}`} disabled={busy}>
        <div className={wizard.cardHeading}>
          <h3 ref={heading} tabIndex={-1}>{titles[step]}</h3>
          {!isReview && <p><span className={wizard.required}>*</span> Bắt buộc khi gửi duyệt</p>}
        </div>
        <div className={wizard.cardBody}>
        {error && <p className="notice error" role="alert">{error}</p>}
        {!isReview && (
          <div className={wizard.fields}>
            {step === 0 && (
              <>
                <label>
                  <span>Loại hồ sơ <span className={wizard.required}>*</span></span>
                  <select value={values.campaignType} onChange={(e) => change("campaignType", e.target.value)}>
                    <option value="CAMPAIGN">Chiến dịch</option>
                    <option value="EVENT">Sự kiện</option>
                  </select>
                </label>
                <label>
                  <span>Danh mục thiện nguyện <span className={wizard.required}>*</span></span>
                  <select aria-required="true" value={values.cause} onChange={(e) => change("cause", e.target.value)}>
                    <option value="">Chọn danh mục</option>
                    {Object.entries(causes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
              </>
            )}
            {step === 3 && isEvent && (
              <label className={wizard.wide}>
                Hình thức tổ chức
                <select value={values.eventFormat} onChange={(e) => change("eventFormat", e.target.value)}>
                  <option value="">Chưa xác định</option>
                  {Object.entries(eventFormats).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
            )}
            {step === 3 && showAddress && (
              <CampaignAddressFields address={address} previousLocation={values.location} onChange={setAddress} />
            )}
            {fieldsForStep(step, values).map(({ key, label, type, max, required, placeholder, wide }) => (
              <label key={key} className={wide || step === 0 ? wizard.wide : undefined}>
                <span>{label}{required && <span className={wizard.required}> *</span>}</span>
                {type === "textarea" ? (
                  <textarea aria-required={required || undefined} rows={3} maxLength={max ?? 4000} value={values[key]} onChange={(e) => change(key, e.target.value)} />
                ) : (
                  <input
                    type={type ?? "text"}
                    aria-required={required || undefined}
                    maxLength={max}
                    min={type === "number" ? 1 : undefined}
                    placeholder={placeholder}
                    value={values[key]}
                    onChange={(e) => change(key, e.target.value)}
                  />
                )}
              </label>
            ))}
            {step === 0 && (
              <>
                {isEvent && (
                    <label className={wizard.wide}>
                      Chiến dịch cha
                      <select value={values.parentCampaignId} onChange={(e) => change("parentCampaignId", e.target.value)}>
                        <option value="">Sự kiện độc lập</option>
                        {values.parentCampaignId && !parents.some(({ id }) => id === values.parentCampaignId) && (
                          <option value={values.parentCampaignId}>{parentTitle || "Chiến dịch đã liên kết"}</option>
                        )}
                        {parents.filter(({ id }) => id !== savedDraft.current?.id).map(({ id, title }) => (
                          <option key={id} value={id}>{title}</option>
                        ))}
                      </select>
                      {parentError && <span className="muted">{parentError}</span>}
                    </label>
                )}
                <label className={wizard.attachment}>
                  Ảnh đại diện
                  <small>PNG hoặc JPG, tối đa 5 MB</small>
                  <input type="file" accept=".png,.jpg,.jpeg" onChange={(e) => chooseFile("COVER", e.currentTarget)} />
                </label>
                <label className={wizard.attachment}>
                  Tài liệu minh họa
                  <small>PDF hoặc DOCX, tối đa 5 MB</small>
                  <input type="file" accept=".pdf,.docx" onChange={(e) => chooseFile("DOCUMENT", e.currentTarget)} />
                </label>
                <label className={`${wizard.attachment} ${wizard.wide}`}>
                  Ảnh phụ
                  <small>Có thể chọn nhiều ảnh PNG hoặc JPG cùng lúc, tối đa 5 MB mỗi ảnh.</small>
                  <input type="file" multiple accept=".png,.jpg,.jpeg" onChange={(e) => chooseGallery(e.currentTarget)} />
                </label>
              </>
            )}
          </div>
        )}
        {(step === 0 || isReview) && (galleryPreviews.length > 0 || storedGallery.length > 0) && (
          <section className={wizard.gallery}>
            <h4>Ảnh phụ ({gallery.length + storedGallery.length})</h4>
            <div className={styles.reviewImages}>
              {storedGallery.map(({ id, fileName }) => (
                <figure key={id}>
                  {storedPreviews[id]?.url && <img src={storedPreviews[id].url} alt={fileName} />}
                  <figcaption>{fileName}</figcaption>
                </figure>
              ))}
              {galleryPreviews.map(({ file, url }) => (
                <figure key={fileKey(file.name)}>
                  <img src={url} alt={file.name} />
                  <figcaption>{file.name}</figcaption>
                  <button type="button" className="quiet" aria-label={`Bỏ ảnh ${file.name}`} onClick={() => {
                    setGallery((current) => current.filter((item) => item !== file));
                    setError("");
                  }}>Bỏ ảnh</button>
                </figure>
              ))}
            </div>
          </section>
        )}
        {isReview && <CampaignConceptSummary values={values} address={plannedAddress} parentTitle={parentTitle} editStep={setStep} />}
        {(step === 0 || isReview) && (coverName || documentNames.length > 0) && (
          <div className={styles.conceptFiles}>
            {displayedCoverUrl && <img src={displayedCoverUrl} alt="Ảnh đại diện của đề xuất" />}
            {coverName && <p>Ảnh đại diện · {coverName}</p>}
            {documentNames.length > 0 && <p>Tài liệu · {documentNames.join(", ")}</p>}
          </div>
        )}
        </div>
        <div className={wizard.footer}>
          {step > 0 && <button type="button" className="secondary" onClick={() => setStep(step - 1)}><span aria-hidden="true">← </span>Bước trước</button>}
          <div className={wizard.nextActions}>
            <button type="button" className="secondary" onClick={() => void persist(false)}>Lưu bản nháp</button>
            {isReview
              ? <button type="button" className="primary" onClick={() => void persist(true)}>Gửi duyệt ý tưởng</button>
              : <button type="button" className="primary" onClick={() => setStep(step + 1)}>Tiếp tục <span aria-hidden="true">→</span></button>}
          </div>
        </div>
        {busy && <p className={wizard.saving} role="status">Đang lưu hồ sơ…</p>}
      </fieldset>
    </div>
  );
}
