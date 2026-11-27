import { memberRoles } from "@/features/organizations/types/workspace";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import styles from "./WorkspaceMembers.module.css";

export function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  const initials = name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
  return (
    <span className={styles.avatar} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initials}
    </span>
  );
}

export function Roles({ roles }: { roles: string[] }) {
  return (
    <LocalizedTree>
      <div className={styles.roles}>
        {roles.map((role) => <span key={role}>{memberRoles[role] ?? role}</span>)}
      </div>
    </LocalizedTree>
  );
}
