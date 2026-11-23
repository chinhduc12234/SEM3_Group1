"use client";

import { useState } from "react";
import type { Campaign } from "../types/campaigns";
import type { CampaignSubmissionDetails } from "../types/submission";
import DonationPanel from "./DonationPanel";
import VolunteerRegistrationWizard from "./VolunteerRegistrationWizard";
import css from "./CampaignParticipationOptions.module.css";

type Option = "volunteer" | "donation";

export default function CampaignParticipationOptions({ campaign, details }: {
  campaign: Campaign;
  details: CampaignSubmissionDetails;
}) {
  const [active, setActive] = useState<Option | null>(null);

  if (active === "volunteer") {
    return <VolunteerRegistrationWizard campaign={campaign} details={details} autoOpen onClose={() => setActive(null)} />;
  }
  if (active === "donation") {
    return <DonationPanel campaign={campaign} onClose={() => setActive(null)} />;
  }

  return <section className={css.options} aria-label="Chọn cách tham gia chiến dịch">
    <button type="button" className={css.option} onClick={() => setActive("volunteer")}>
      <span className={css.icon} aria-hidden="true">♧</span>
      <span><strong>Đăng ký tham gia tình nguyện</strong><small>Gửi hồ sơ để quản lý chiến dịch xét duyệt</small></span>
      <span className={css.arrow} aria-hidden="true">↗</span>
    </button>
    <button type="button" className={`${css.option} ${css.donation}`} onClick={() => setActive("donation")}>
      <span className={css.icon} aria-hidden="true">♡</span>
      <span><strong>Ủng hộ chiến dịch</strong><small>Ủng hộ bằng tiền hoặc hiện vật</small></span>
      <span className={css.arrow} aria-hidden="true">↗</span>
    </button>
  </section>;
}
