"use client";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { Protected, useAuth } from "@/features/auth/components/AuthProvider";
import { api, apiBlob } from "@/shared/api/api";

type UserProfile = { id: string; email: string | null; fullName: string; phoneNumber: string | null; address: string | null; dateOfBirth: string | null; hasAvatar: boolean };

function AccountPage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAvatar = useCallback(async () => {
    let objectUrl = "";
    try { const blob = await apiBlob(`/api/auth/profile/avatar?v=${Date.now()}`); objectUrl = URL.createObjectURL(blob); }
    catch { objectUrl = ""; }
    setAvatarUrl(current => { if (current) URL.revokeObjectURL(current); return objectUrl; });
  }, []);

  useEffect(() => {
    let active = true;
    api<UserProfile>("/api/auth/profile/details").then(result => { if (active) setProfile(result); })
      .catch(ex => { if (active) setError((ex as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    void loadAvatar();
    return () => { active = false; };
  }, [loadAvatar]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await api<UserProfile>("/api/auth/profile/details", { method: "PUT", body: JSON.stringify({
        fullName: profile.fullName.trim(), email: profile.email?.trim(), phoneNumber: profile.phoneNumber?.trim() || null,
        address: profile.address?.trim() || null, dateOfBirth: profile.dateOfBirth || null
      }) });
      setProfile(updated);
      if (user) updateUser({ ...user, fullName: updated.fullName, email: updated.email ?? user.email });
      setMessage("Thông tin cá nhân đã được cập nhật.");
    } catch (ex) { setError((ex as Error).message); }
    finally { setBusy(false); }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setError(""); setMessage("");
    if (file.size > 5 * 1024 * 1024) { setError("Ảnh cần có dung lượng dưới 5 MB."); return; }
    if (!/image\/(jpeg|png|webp)/i.test(file.type)) { setError("Chọn ảnh JPEG, PNG hoặc WebP."); return; }
    setAvatarBusy(true);
    try {
      const form = new FormData(); form.append("avatar", file);
      await api("/api/auth/profile/avatar", { method: "PUT", body: form });
      await loadAvatar(); setProfile(current => current ? { ...current, hasAvatar: true } : current);
      window.dispatchEvent(new Event("giveaid-profile-avatar-updated"));
      setMessage("Ảnh đại diện đã được cập nhật.");
    } catch (ex) { setError((ex as Error).message); }
    finally { setAvatarBusy(false); }
  }

  async function removeAvatar() {
    setAvatarBusy(true); setError(""); setMessage("");
    try {
      await api("/api/auth/profile/avatar", { method: "DELETE" });
      setAvatarUrl(current => { if (current) URL.revokeObjectURL(current); return ""; });
      setProfile(current => current ? { ...current, hasAvatar: false } : current);
      window.dispatchEvent(new Event("giveaid-profile-avatar-updated"));
      setMessage("Đã gỡ ảnh đại diện.");
    } catch (ex) { setError((ex as Error).message); }
    finally { setAvatarBusy(false); }
  }

  const displayName = profile?.fullName || user?.fullName || "Người dùng";
  const initials = displayName.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();
  return <div className="user-profile-page">
    <div className="user-profile-heading"><div><p className="eyebrow">KHÔNG GIAN CỦA BẠN</p><h1>Hồ sơ cá nhân</h1><p>Quản lý thông tin liên hệ và cách bạn xuất hiện trên Give-AID.</p></div><span className="user-profile-private">🔒 Chỉ bạn xem được thông tin cá nhân</span></div>

    <section className="user-profile-cover" aria-label="Ảnh bìa hồ sơ"><div className="user-profile-cover-orbit"/><span>GIVE-AID · KẾT NỐI NHỮNG ĐIỀU TỐT ĐẸP</span></section>
    <section className="user-profile-card user-profile-intro">
      <div className="user-avatar-wrap"><div className="user-avatar">{avatarUrl ? <img src={avatarUrl} alt={`Ảnh đại diện của ${displayName}`} /> : <span>{initials}</span>}</div>
        <label className="user-avatar-upload">{avatarBusy ? "Đang tải…" : "Đổi ảnh đại diện"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarBusy} /></label>
        {profile?.hasAvatar && <button type="button" className="user-avatar-remove" onClick={removeAvatar} disabled={avatarBusy}>Gỡ ảnh</button>}
      </div>
      <div className="user-profile-summary"><span className="user-profile-kicker">TÀI KHOẢN GIVE-AID</span><h2>{displayName}</h2><p>{profile?.email || user?.email}</p><span className="user-member-badge">Thành viên cộng đồng</span></div>
      <div className="user-profile-edit-hint"><span>✦</span><p>Thông tin chính xác giúp mọi người dễ kết nối và đồng hành cùng bạn.</p></div>
    </section>

    <div className="user-profile-columns">
      <section className="user-profile-card user-profile-details">
        <div className="user-section-heading"><div><span className="user-profile-kicker">THÔNG TIN CỦA BẠN</span><h2>Thông tin cá nhân</h2></div><span className="user-section-number">01</span></div>
        {loading ? <p className="user-profile-muted">Đang tải hồ sơ…</p> : profile && <form onSubmit={saveProfile}>
          <div className="user-form-grid">
            <label>Họ và tên<input required minLength={2} maxLength={200} autoComplete="name" value={profile.fullName} onChange={e => setProfile({ ...profile, fullName: e.target.value })} /></label>
            <label>Email<input required type="email" maxLength={256} autoComplete="email" value={profile.email ?? ""} onChange={e => setProfile({ ...profile, email: e.target.value })} /><small>Email đăng nhập tài khoản.</small></label>
            <label>Số điện thoại<input type="tel" maxLength={25} autoComplete="tel" placeholder="Ví dụ: 0912 345 678" value={profile.phoneNumber ?? ""} onChange={e => setProfile({ ...profile, phoneNumber: e.target.value })} /></label>
            <label>Ngày sinh<input type="date" autoComplete="bday" value={profile.dateOfBirth?.slice(0, 10) ?? ""} onChange={e => setProfile({ ...profile, dateOfBirth: e.target.value })} /><small>Chỉ hiển thị với bạn.</small></label>
            <label className="user-field-full">Địa chỉ<textarea rows={3} maxLength={400} autoComplete="street-address" placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" value={profile.address ?? ""} onChange={e => setProfile({ ...profile, address: e.target.value })} /></label>
          </div>
          <div className="user-profile-form-footer"><p>Thông tin của bạn được dùng để liên hệ về hoạt động Give-AID.</p><button disabled={busy || loading}>{busy ? "Đang lưu…" : "Lưu hồ sơ"}</button></div>
        </form>}
      </section>

      <aside className="user-profile-side">
        <section className="user-profile-card user-profile-about"><span className="user-profile-kicker">GIỚI THIỆU</span><h2>Mỗi hành trình sẻ chia bắt đầu từ một kết nối.</h2><p>Hồ sơ được cập nhật giúp bạn đồng hành cùng các chiến dịch cộng đồng dễ dàng hơn.</p><div className="user-profile-side-stat"><span>✧</span><div><strong>Give-AID</strong><small>Cùng sẻ chia, cùng thay đổi</small></div></div></section>
      </aside>
    </div>
    {error && <p className="user-profile-alert error" role="alert">{error}</p>}
    {message && <p className="user-profile-alert success" role="status">{message}</p>}
    <p className="user-profile-footnote">Give-AID · Thông tin cá nhân của bạn luôn được bảo vệ.</p>
  </div>;
}

export default function Page() { return <Protected><AccountPage /></Protected>; }
