import { useEffect, useState } from "react";
import type { Bank } from "../campaignManagement";

export function useCampaignLookups(province: string, bankTransfer: boolean, step: number) {
  const [wards, setWards] = useState<{ ma_xa: string; ten: string; loai: string }[]>([]),
    [wardStatus, setWardStatus] = useState<"idle" | "loading" | "ready" | "error">("idle"),
    [wardRetry, setWardRetry] = useState(0);
  const [banks, setBanks] = useState<Bank[]>([]),
    [bankStatus, setBankStatus] = useState<"idle" | "loading" | "ready" | "error">("idle"),
    [bankRetry, setBankRetry] = useState(0);
  const [provinces, setProvinces] = useState<{ code: number; name: string; codename: string }[]>(
      [],
    ),
    [provinceError, setProvinceError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("https://provinces.open-api.vn/api/v2/")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((items) => {
        if (active) {
          setProvinces(items);
          setProvinceError(false);
        }
      })
      .catch(() => {
        if (active) setProvinceError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!bankTransfer) return;
    const controller = new AbortController();
    setBankStatus("loading");
    fetch("https://api.vietqr.io/v2/banks", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (result.code !== "00" || !Array.isArray(result.data)) throw new Error();
        const items: Bank[] = result.data
          .filter(
            (bank: Bank) =>
              typeof bank.code === "string" &&
              typeof bank.shortName === "string" &&
              typeof bank.name === "string" &&
              typeof bank.logo === "string",
          )
          .sort((a: Bank, b: Bank) => a.shortName.localeCompare(b.shortName, "vi"));
        if (!items.length) throw new Error();
        setBanks(items);
        setBankStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setBankStatus("error");
      });
    return () => controller.abort();
  }, [bankTransfer, bankRetry]);
  const selectedProvince = provinces.find((p) => p.name === province);
  useEffect(() => {
    if (step !== 6 || !selectedProvince) {
      setWardStatus("idle");
      return;
    }
    const controller = new AbortController();
    setWards([]);
    setWardStatus("loading");
    fetch(
      `https://diachiviet.com/api/v1/xa/${selectedProvince.codename.replaceAll("_", "-")}.json`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data.dong)) throw new Error();
        setWards(
          data.dong.filter((w: { ma_tinh: string }) => Number(w.ma_tinh) === selectedProvince.code),
        );
        setWardStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setWardStatus("error");
      });
    return () => controller.abort();
  }, [selectedProvince, wardRetry, step]);

  return {
    banks,
    bankStatus,
    provinces,
    provinceError,
    wards,
    wardStatus,
    setBankRetry,
    setWardRetry,
  };
}
