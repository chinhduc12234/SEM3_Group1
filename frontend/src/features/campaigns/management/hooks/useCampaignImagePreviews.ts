import { useEffect, useState } from "react";
import { apiBlob } from "@/shared/api/api";
import type { Campaign } from "@/features/campaigns/types/campaigns";

export function useCampaignImagePreviews(
  cover: File | null,
  evidence: File[],
  gallery: File[],
  selected: Campaign | null,
) {
  const [imagePreviews, setImagePreviews] = useState<{ file: File; url: string }[]>([]);
  useEffect(() => {
    const previews = [...(cover ? [cover] : []), ...evidence, ...gallery].map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setImagePreviews(previews);
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [cover, evidence, gallery]);
  const [mediaPreviews, setMediaPreviews] = useState<
    Record<string, { url?: string; error?: string }>
  >({});
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    setMediaPreviews({});
    const images =
      selected?.media.filter(
        (media) => media.kind !== "DOCUMENT" && media.contentType.startsWith("image/"),
      ) || [];
    if (!selected || !images.length)
      return () => {
        active = false;
      };
    void Promise.all(
      images.map(async (media) => {
        try {
          const blob = await apiBlob(`/api/campaigns/${selected.id}/media/${media.id}`);
          if (!active) return [media.id, {}] as const;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return [media.id, { url }] as const;
        } catch {
          return [
            media.id,
            { error: "Không tải được ảnh xem trước. Bạn vẫn có thể tải tệp để kiểm tra." },
          ] as const;
        }
      }),
    ).then((entries) => {
      if (active) setMediaPreviews(Object.fromEntries(entries));
    });
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selected?.id, selected?.media]);

  return { imagePreviews, mediaPreviews };
}
