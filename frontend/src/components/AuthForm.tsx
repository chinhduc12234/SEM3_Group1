"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { api } from "@/lib/api";
export default function AuthForm({register=false}:{register?:boolean}) {
 const {login}=useAuth(); const router=useRouter();
 const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false); const [done,setDone]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setMessage("");const form=new FormData(e.currentTarget);
  if(register && form.get("password")!==form.get("confirm")){setMessage("Mật khẩu xác nhận chưa khớp.");return;}
  setBusy(true);
  try{
   if(register){await api("/api/auth/register",{method:"POST",body:JSON.stringify({fullName:form.get("fullName"),email:form.get("email"),password:form.get("password")})});setDone(true);}
   else {
    const account=await login(String(form.get("email")),String(form.get("password")));
    if(account.roles.includes("ADMIN")){router.push("/admin");return;}
    let destination="/";
    try {
      const memberships=await api<{id:string}[]>("/api/organizations/workspaces/mine");
      if(memberships.length===1)destination=`/organizations/${memberships[0].id}/manage`;
      else if(memberships.length>1||(await api<unknown[]>("/api/organizations/invitations/mine")).length>0)destination="/organizations/mine";
    }catch{ /* Login remains usable when organization data is temporarily unavailable. */ }
    router.push(destination);
   }
  }catch(ex){setMessage((ex as Error).message);}finally{setBusy(false);}
 }
 return <main className="ga-auth"><div className="ga-auth-photo"><div><p className="ga-overline"><span/> CÙNG NHAU SẺ CHIA</p><h1>Điều tốt đẹp<br/><em>bắt đầu từ bạn.</em></h1><p>Một cộng đồng dành cho những người tin vào sức mạnh của sự tử tế.</p></div><small>GIVE-AID · CÙNG NHAU TẠO NÊN THAY ĐỔI</small></div><div className="ga-auth-main"><Link className="ga-back" href="/">← Về trang chủ</Link><div className="ga-auth-box"><p className="ga-kicker">{register?"THAM GIA CỘNG ĐỒNG":"CHÀO MỪNG TRỞ LẠI"}</p><h2>{register?"Tạo tài khoản":"Đăng nhập"}</h2><p>{register?"Bắt đầu hành trình sẻ chia cùng Give-AID.":"Tiếp tục hành trình sẻ chia của bạn."}</p>{done ? <div className="notice success" role="status">Đăng ký thành công. <Link className="ga-text-link" href="/login">Đăng nhập để tiếp tục →</Link></div> : <form onSubmit={submit} aria-busy={busy}>{register && <label>Họ và tên<input name="fullName" required minLength={2} maxLength={200} autoComplete="name" placeholder="Nhập họ và tên"/></label>}<label>Email<input type="email" name="email" required maxLength={256} autoComplete={register?"email":"username"} placeholder="ban@example.com"/></label><label>Mật khẩu<input type="password" name="password" required minLength={register?12:undefined} maxLength={128} autoComplete={register?"new-password":"current-password"} placeholder="Nhập mật khẩu" aria-describedby={register?"password-help":undefined}/>{register && <small id="password-help">Tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small>}</label>{register && <label>Xác nhận mật khẩu<input type="password" name="confirm" required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Nhập lại mật khẩu"/></label>}{message && <p className="ga-form-message" role="alert">{message}</p>}<button className="ga-button ga-auth-submit" disabled={busy} type="submit">{busy?"Đang xử lý…":register?"Tạo tài khoản":"Đăng nhập"}<span>↗</span></button></form>}<p className="ga-auth-switch">{register?"Đã có tài khoản?":"Bạn chưa có tài khoản?"} <Link href={register?"/login":"/register"}>{register?"Đăng nhập":"Đăng ký ngay"}</Link></p></div></div></main>;
}
