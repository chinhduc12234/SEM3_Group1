"use client";

import { useEffect, useRef, useState } from "react";
import type { Campaign } from "../types/campaigns";
import DonationPanel from "./DonationPanel";
import VolunteerRegistrationWizard from "./VolunteerRegistrationWizard";
import css from "./CampaignParticipationOptions.module.css";

type Option = "volunteer" | "donation";

export default function CampaignParticipationOptions({ campaign }: { campaign: Campaign }) {
  const [active, setActive] = useState<Option | null>(null);
  const [opened, setOpened] = useState<Partial<Record<Option, true>>>({});
  const choices = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<Option | null | undefined>(undefined);
  const [initialDonationMode, setInitialDonationMode] = useState<"money" | "in-kind">("money");
  const [resumeDonationId, setResumeDonationId] = useState<string>();

  function choose(option: Option) {
    if (option === active) {
      panel.current?.focus();
      return;
    }
    focusTarget.current = option;
    setOpened((current) => ({ ...current, [option]: true }));
    setActive(option);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("tham-gia");
    if (mode !== "ung-ho" && mode !== "hien-vat") return;
    setInitialDonationMode(mode === "hien-vat" ? "in-kind" : "money");
    const resume = params.get("donation");
    if (mode === "ung-ho" && resume && /^[a-f0-9-]{36}$/i.test(resume)) setResumeDonationId(resume);
    focusTarget.current = "donation";
    setOpened({ donation: true });
    setActive("donation");
  }, []);

  useEffect(() => {
    if (focusTarget.current !== active) return;
    focusTarget.current = undefined;
    (active ? panel : choices).current?.focus();
  }, [active]);

  function back() {
    focusTarget.current = null;
    setActive(null);
  }

  return <section aria-label="Chọn cách tham gia chiến dịch">
    <div className={css.options} ref={choices} tabIndex={-1}>
    <button type="button" className={css.option} aria-expanded={active === "volunteer"}
      aria-controls="campaign-volunteer-panel" onClick={() => choose("volunteer")}>
      <span className={css.icon} aria-hidden="true">♧</span>
      <span><strong>Đăng ký tham gia tình nguyện</strong><small>Gửi hồ sơ và theo dõi kết quả xếp ca</small></span>
      <span className={css.arrow} aria-hidden="true">↗</span>
    </button>
    <button type="button" className={`${css.option} ${css.donation}`} aria-expanded={active === "donation"}
      aria-controls="campaign-donation-panel" onClick={() => choose("donation")}>
      <span className={css.icon} aria-hidden="true">♡</span>
      <span><strong>Ủng hộ chiến dịch</strong><small>Ủng hộ bằng tiền hoặc hiện vật</small></span>
      <span className={css.arrow} aria-hidden="true">↗</span>
    </button>
    </div>
    <div id="campaign-volunteer-panel" hidden={active !== "volunteer"} tabIndex={-1}
      ref={active === "volunteer" ? panel : undefined}>
      {opened.volunteer && <VolunteerRegistrationWizard campaign={campaign} active={active === "volunteer"}
        onClose={back} onDonate={() => choose("donation")} />}
    </div>
    <div id="campaign-donation-panel" hidden={active !== "donation"} tabIndex={-1}
      ref={active === "donation" ? panel : undefined}>
      {opened.donation && <DonationPanel campaign={campaign} initialMode={initialDonationMode} resumeId={resumeDonationId}
        onClose={back} onVolunteer={() => choose("volunteer")} />}
    </div>
  </section>;
}
