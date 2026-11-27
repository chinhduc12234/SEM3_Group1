"use client";

import { useEffect, useRef, useState } from "react";
import type { Campaign } from "../types/campaigns";
import DonationPanel from "./donation/DonationPanel";
import VolunteerRegistrationWizard from "./volunteer/VolunteerRegistrationWizard";
import css from "./CampaignParticipationOptions.module.css";

type Option = "volunteer" | "donation";

export default function CampaignParticipationOptions({ campaign }: { campaign: Campaign }) {
  const [active, setActive] = useState<Option | null>(null);
  const [opened, setOpened] = useState<Partial<Record<Option, true>>>({});
  const [resumeDonationId, setResumeDonationId] = useState<string>();
  const volunteerChoice = useRef<HTMLButtonElement>(null);
  const donationChoice = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const pressedBackdrop = useRef(false);

  function choose(option: Option) {
    if (!active) {
      returnFocus.current = (option === "volunteer" ? volunteerChoice : donationChoice).current;
    }
    setOpened((current) => ({ ...current, [option]: true }));
    setActive(option);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tham-gia") !== "ung-ho") return;
    const resume = params.get("donation");
    if (resume && /^[a-f0-9-]{36}$/i.test(resume)) setResumeDonationId(resume);
    returnFocus.current = donationChoice.current;
    setOpened({ donation: true });
    setActive("donation");
  }, []);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (active) {
      if (!modal.open) modal.showModal();
      scrollArea.current?.scrollTo({ top: 0 });
      closeButton.current?.focus({ preventScroll: true });
    } else if (modal.open) {
      modal.close();
      returnFocus.current?.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [active]);

  return (
    <section className={css.participation} aria-label="Chọn cách tham gia chiến dịch">
      <div className={css.options}>
        <button type="button" className={css.option} aria-haspopup="dialog" aria-expanded={active === "volunteer"}
          aria-controls="campaign-participation-dialog" ref={volunteerChoice} onClick={() => choose("volunteer")}>
          <span><strong>Đăng ký tham gia tình nguyện</strong><small>Gửi hồ sơ và theo dõi kết quả xếp ca</small></span>
          <span className={css.arrow} aria-hidden="true">↗</span>
        </button>
        <button type="button" className={`${css.option} ${css.donation}`} aria-haspopup="dialog" aria-expanded={active === "donation"}
          aria-controls="campaign-participation-dialog" ref={donationChoice} onClick={() => choose("donation")}>
          <span><strong>Ủng hộ chiến dịch</strong><small>Chọn khoản đóng góp và xem tiến độ gây quỹ</small></span>
          <span className={css.arrow} aria-hidden="true">↗</span>
        </button>
      </div>

      <dialog ref={dialog} id="campaign-participation-dialog" className={css.dialog} data-mode={active ?? undefined}
        aria-labelledby={active === "volunteer" ? "volunteer-form-title" : "donation-title"}
        onCancel={(event) => { event.preventDefault(); setActive(null); }}
        onPointerDown={(event) => { pressedBackdrop.current = event.target === event.currentTarget; }}
        onClick={(event) => {
          if (pressedBackdrop.current && event.target === event.currentTarget) setActive(null);
          pressedBackdrop.current = false;
        }}>
        <div className={css.closeBar}>
          <span>{campaign.title}</span>
          <button type="button" ref={closeButton} className={css.close} onClick={() => setActive(null)} aria-label="Đóng cửa sổ">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div ref={scrollArea} className={css.scrollArea} data-participation-scroll="">
          <div id="campaign-volunteer-panel" hidden={active !== "volunteer"}>
            {opened.volunteer && <VolunteerRegistrationWizard campaign={campaign} active={active === "volunteer"}
              onDonate={() => choose("donation")} />}
          </div>
          <div id="campaign-donation-panel" hidden={active !== "donation"}>
            {opened.donation && <DonationPanel campaign={campaign} resumeId={resumeDonationId}
              onVolunteer={() => choose("volunteer")} />}
          </div>
        </div>
      </dialog>
    </section>
  );
}
