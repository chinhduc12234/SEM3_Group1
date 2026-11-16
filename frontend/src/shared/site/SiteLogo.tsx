import Link from "next/link";
import type { MouseEventHandler } from "react";

type Props = {
  href: string;
  label: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function SiteLogo({ href, label, className, onClick }: Props) {
  return (
    <Link
      className={className ? `ga-logo ${className}` : "ga-logo"}
      href={href}
      aria-label={label}
      onClick={onClick}
    >
      <img className="ga-logo-image" src="/giveaid-logo-transparent.png" alt="Give-AID" />
    </Link>
  );
}
