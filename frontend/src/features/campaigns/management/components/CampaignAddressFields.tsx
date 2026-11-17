import { useEffect, useState } from "react";
import type { AddressUnit, PlannedCampaignAddress } from "../../types/campaigns";
import wizard from "../CampaignWizard.module.css";

const apiRoot = "https://provinces.open-api.vn/api";
const cachedUnits = new Map<string, AddressUnit[]>();

function useAddressUnits(path: string | null, collection?: "districts" | "wards") {
  const [result, setResult] = useState<{ path: string; items: AddressUnit[]; error: boolean }>();
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!path || cachedUnits.has(path)) return;
    const controller = new AbortController();
    fetch(apiRoot + path, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        const units = collection ? data[collection] : data;
        if (!Array.isArray(units)) throw new Error();
        const items = units.map(({ code, name }) => ({ code, name })) as AddressUnit[];
        cachedUnits.set(path, items);
        if (!controller.signal.aborted) setResult({ path, items, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ path, items: [], error: true });
      });
    return () => controller.abort();
  }, [attempt, collection, path]);
  const items = path ? cachedUnits.get(path) : undefined;
  return {
    items: items ?? [],
    error: !items && result?.path === path && result.error,
    loading: !!path && !items && result?.path !== path,
    retry: () => {
      setResult(undefined);
      retry((current) => current + 1);
    },
  };
}

function UnitSelect({ label, prompt, value, lookup, onChange }: {
  label: string;
  prompt: string;
  value: AddressUnit | null;
  lookup: ReturnType<typeof useAddressUnits>;
  onChange: (value: AddressUnit | null) => void;
}) {
  const { items, error, loading, retry } = lookup;
  return (
    <div className={wizard.addressUnit}>
      <label>
        {label}
        <select
          value={value?.code ?? ""}
          disabled={!items.length}
          onChange={(event) => onChange(items.find(({ code }) => code === Number(event.target.value)) ?? null)}
        >
          <option value="">{loading ? "Đang tải danh mục…" : prompt}</option>
          {value && !items.some(({ code }) => code === value.code) && <option value={value.code}>{value.name}</option>}
          {items.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      {error && (
        <div className={wizard.addressError} role="status">
          Không tải được danh mục. <button type="button" className="quiet" onClick={retry}>Thử lại</button>
        </div>
      )}
    </div>
  );
}

export default function CampaignAddressFields({ address, previousLocation, onChange,
  legend = "Khu vực và địa chỉ dự kiến", detailLabel = "Địa chỉ chi tiết dự kiến" }: {
  address: PlannedCampaignAddress;
  previousLocation: string;
  onChange: (address: PlannedCampaignAddress) => void;
  legend?: string;
  detailLabel?: string;
}) {
  const { mode, province, district, ward, detail } = address;
  const legacy = mode === "LEGACY";
  const version = legacy ? "v1" : "v2";
  const provinces = useAddressUnits(`/${version}/`);
  const districts = useAddressUnits(legacy && province ? `/v1/p/${province.code}?depth=2` : null, "districts");
  const wards = useAddressUnits(
    legacy ? (district ? `/v1/d/${district.code}?depth=2` : null) : (province ? `/v2/p/${province.code}?depth=2` : null),
    "wards",
  );

  return (
    <fieldset className={`${wizard.address} ${wizard.wide}`}>
      <legend>{legend}</legend>
      {previousLocation && <p className={wizard.addressNote}>Địa điểm đã lưu: {previousLocation}. Chọn địa chỉ mới nếu cần cập nhật.</p>}
      <div className={wizard.fields}>
        <label className={wizard.wide}>
          Danh mục địa chỉ
          <select value={mode} onChange={(event) => onChange({
            ...address, mode: event.target.value === "LEGACY" ? "LEGACY" : "CURRENT", province: null, district: null, ward: null,
          })}>
            <option value="CURRENT">Địa chỉ hiện hành</option>
            <option value="LEGACY">Địa chỉ cũ có quận/huyện</option>
          </select>
        </label>
        <UnitSelect label="Tỉnh/thành phố" prompt="Chọn tỉnh/thành phố" value={province} lookup={provinces}
          onChange={(value) => onChange({ ...address, province: value, district: null, ward: null })} />
        {legacy && (
          <UnitSelect label="Quận/huyện" prompt={province ? "Chọn quận/huyện" : "Chọn tỉnh/thành phố trước"} value={district}
            lookup={districts} onChange={(value) => onChange({ ...address, district: value, ward: null })} />
        )}
        <UnitSelect label="Phường/xã" prompt={(legacy ? district : province) ? "Chọn phường/xã" : (legacy ? "Chọn quận/huyện trước" : "Chọn tỉnh/thành phố trước")}
          value={ward} lookup={wards} onChange={(value) => onChange({ ...address, ward: value })} />
        <label className={wizard.wide}>
          {detailLabel}
          <input type="text" value={detail ?? ""} maxLength={200} placeholder="Tên địa điểm, số nhà, đường hoặc thôn/ấp"
            onChange={(event) => onChange({ ...address, detail: event.target.value })} />
        </label>
      </div>
    </fieldset>
  );
}
