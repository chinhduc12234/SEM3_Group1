import { ProgressTrack } from "@/shared/ui/StatusVisuals";

export function VolunteerCapacity({ target, assigned, confirmed }: { target: number; assigned: number; confirmed: number }) {
  return <ProgressTrack limit={target} segments={[
    { value: confirmed, tone: "positive" },
    { value: Math.max(0, assigned - confirmed), tone: "info" },
  ]} label={`Chỉ tiêu ${target} người, đã xếp ${assigned}, đã xác nhận ${confirmed}`} />;
}
