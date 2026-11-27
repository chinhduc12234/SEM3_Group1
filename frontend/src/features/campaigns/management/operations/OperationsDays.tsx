import CampaignAddressFields from "../components/CampaignAddressFields";
import CampaignRouteMap from "../../components/itinerary/CampaignRouteMap";
import type { Campaign, PlannedCampaignAddress } from "../../types/campaigns";
import { formatPlannedAddress } from "../campaignConceptFields";
import { operationsRouteStops } from "./operationsRouteStops";
import { field, person, replace } from "./OperationsFields";
import type { Day, EditPlan, OperationsView, Plan } from "./operationsTypes";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import styles from "../CampaignManagement.module.css";

const emptyAddress: PlannedCampaignAddress = { mode: "CURRENT", province: null, district: null, ward: null, detail: "" };

export default function OperationsDays({ plan, view, selectedDay, campaign, pinDayId, setPinDayId, setDayId, isOutside, edit, removeDay, busy }: {
  plan: Plan; view: OperationsView; selectedDay?: Day; campaign: Campaign; pinDayId?: string;
  setPinDayId: (id?: string) => void; setDayId: (id: string) => void; isOutside: (date: string | null) => boolean;
  edit: EditPlan; removeDay: (day: Day) => void; busy: boolean;
}) {
  const { startDate, endDate } = campaign;
  return <LocalizedTree>
    {plan.days.length === 0 && <p>Chưa có ngày triển khai.</p>}
    {startDate && endDate && !view.hasAutomaticCalendar &&
      <p className="muted">Khoảng đã duyệt dài hơn 366 ngày. Hãy thêm những ngày thực tế cần lên lịch.</p>}
    {selectedDay && (() => {
      const day = selectedDay;
      const calendarDay = view.hasAutomaticCalendar && !!day.date && !isOutside(day.date);
      function update(values: Partial<Day>) {
        edit((p) => ({ ...p, days: replace(p.days, day.id, values) }));
      }
      return <div className={styles.operationsItem} key={day.id}>
        <div className={styles.operationsFields}>
          {calendarDay
            ? <label>Ngày thực hiện<input type="date" value={day.date ?? ""} readOnly /></label>
            : field("Ngày thực hiện", day.date, (date) => update({ date: date || null, extraApprovedAt: null, activitiesDone: false }), "date")}
          {field("Tên ngày hoặc giai đoạn", day.title, (title) => update({ title }))}
          {field("Mục tiêu trong ngày", day.objective, (objective) => update({ objective }))}
          {!day.address && (day.location !== campaign.location || !campaign.concept?.plannedAddress) &&
            field("Địa điểm chính", day.location, (location) => update({ location, mapPin: null }))}
          {person("Người phụ trách ngày", view.members, day.leadUserId, (leadUserId) => update({ leadUserId }))}
          {field("Mô tả", day.description, (description) => update({ description }), "textarea")}
          {field("Ghi chú đặc biệt", day.notes, (notes) => update({ notes }), "textarea")}
          {isOutside(day.date) && field("Lý do bổ sung ngày", day.extraReason ?? "", (extraReason) =>
            update({ extraReason, extraApprovedAt: null }), "textarea")}
        </div>
        {campaign.concept?.eventFormat !== "ONLINE" && <>
          <CampaignAddressFields address={day.address ?? (day.location === campaign.location ? campaign.concept?.plannedAddress : null) ?? emptyAddress}
            previousLocation={!day.address ? day.location : ""} legend="Địa chỉ ngày triển khai"
            detailLabel="Địa chỉ cụ thể ngày triển khai" onChange={(address) =>
              update({ address, location: formatPlannedAddress(address), mapPin: null })} />
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setPinDayId(pinDayId === day.id ? undefined : day.id)}>
              {pinDayId === day.id ? "Đóng bản đồ đặt ghim" : "Đặt ghim trên bản đồ"}
            </button>
            {day.mapPin && <button type="button" className="quiet" onClick={() => update({ mapPin: null })}>Xóa ghim</button>}
          </div>
          {pinDayId === day.id && <CampaignRouteMap stops={operationsRouteStops([day], campaign)} province=""
            onPick={(mapPin) => { if (view.canEdit && !busy) update({ mapPin }); }} />}
        </>}
        {view.canEdit && !calendarDay && <button type="button" className="quiet" onClick={() => removeDay(day)}>Bỏ ngày</button>}
      </div>;
    })()}
    {view.canEdit && <button type="button" className="secondary" onClick={() => {
      const id = crypto.randomUUID();
      setDayId(id);
      edit((p) => ({
        ...p, days: [...p.days, { id, date: p.days.length ? null : startDate,
          title: "", objective: "", description: "", location: campaign.location, address: campaign.concept?.plannedAddress,
          leadUserId: null, notes: "", activities: [] }],
      }));
    }}>Thêm ngày triển khai</button>}
  </LocalizedTree>;
}
