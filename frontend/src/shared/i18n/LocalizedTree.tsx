"use client";

import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { useLocale } from "./LocaleProvider";
import { en } from "./messages.en";
import { type Locale, translateText } from "./translate";

function translateNode(node: ReactNode, locale: Locale): ReactNode {
  if (typeof node === "string") return translateText(node, locale);
  if (Array.isArray(node)) return Children.map(node, (child) => translateNode(child, locale));
  if (!isValidElement<Record<string, unknown>>(node)) return node;
  const props = node.props;
  const nextProps: Record<string, unknown> = {};
  if (locale === "en") {
    for (const key of ["aria-label", "aria-description", "placeholder", "title", "alt"]) {
      const value = props[key];
      if (typeof value === "string" && en[value.trim()])
        nextProps[key] = translateText(value, locale);
    }
  }
  if (props.children === undefined)
    return Object.keys(nextProps).length ? cloneElement(node, nextProps) : node;
  return cloneElement(node, nextProps, translateNode(props.children as ReactNode, locale));
}

export function LocalizedTree({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  return <>{translateNode(children, locale)}</>;
}
