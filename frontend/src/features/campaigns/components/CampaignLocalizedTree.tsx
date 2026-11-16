"use client";

import { Children, cloneElement, isValidElement, type ReactNode, useEffect, useState } from "react";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { translateText } from "@/shared/i18n/translate";

function hasVietnamese(text: string) {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text);
}

function DynamicText({ text }: { text: string }) {
  const { locale } = useLocale();
  const knownTranslation = translateText(text, locale);
  const [automaticTranslation, setAutomaticTranslation] = useState("");

  useEffect(() => {
    let active = true;
    setAutomaticTranslation("");
    if (locale !== "en" || knownTranslation !== text || !hasVietnamese(text))
      return () => {
        active = false;
      };

    const cacheKey = `giveaid-campaign-en:${text}`;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        setAutomaticTranslation(saved);
        return () => {
          active = false;
        };
      }
    } catch {
      // Translation remains available for this page if storage is disabled.
    }

    fetch("/campaign-translation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Translation failed.");
        return (await response.json()) as { text: string };
      })
      .then(({ text: translated }) => {
        if (!active || !translated) return;
        setAutomaticTranslation(translated);
        try {
          localStorage.setItem(cacheKey, translated);
        } catch {
          // Continue without a persistent cache when storage is unavailable.
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [locale, knownTranslation, text]);

  return <>{automaticTranslation || knownTranslation}</>;
}

function translateNode(node: ReactNode): ReactNode {
  if (typeof node === "string") return <DynamicText text={node} />;
  if (Array.isArray(node)) return Children.map(node, translateNode);
  if (!isValidElement<{ children?: ReactNode }>(node) || node.props.children === undefined) return node;
  return cloneElement(node, undefined, translateNode(node.props.children));
}

export default function CampaignLocalizedTree({ children }: { children: ReactNode }) {
  return <>{translateNode(children)}</>;
}
