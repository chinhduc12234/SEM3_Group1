"use client";

import accountStyles from "@/features/account/Account.module.css";
import Protected from "@/features/auth/components/Protected";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
function History() {
  return (
    <LocalizedTree>
      <div className={accountStyles.accountSubpage}>
        <header className={accountStyles.accountPageHeading}>
          <p className={accountStyles.userProfileKicker}>HÀNH TRÌNH SẺ CHIA</p>
          <h1>Lịch sử tham gia</h1>
          <p>Theo dõi các chiến dịch bạn tham gia, khoản đóng góp và hoạt động cộng đồng.</p>
        </header>
        <div className={accountStyles.accountHistorySummary}>
          <section>
            <small>CHIẾN DỊCH ĐÃ THAM GIA</small>
            <strong>—</strong>
            <span>Sẽ cập nhật khi có hoạt động</span>
          </section>
          <section>
            <small>TỔNG ĐÓNG GÓP</small>
            <strong>—</strong>
            <span>Chưa có giao dịch thanh toán</span>
          </section>
          <section>
            <small>HOẠT ĐỘNG CỘNG ĐỒNG</small>
            <strong>—</strong>
            <span>Lịch sử đang chờ tích hợp</span>
          </section>
        </div>
        <section className={`${accountStyles.accountSubcard} ${accountStyles.accountHistoryEmpty}`}>
          <span className={accountStyles.accountHistoryIllustration}>◷</span>
          <h2>Hành trình của bạn sẽ bắt đầu tại đây</h2>
          <p>
            Khi bạn tham gia chiến dịch hoặc xác nhận đóng góp, thời gian, nội dung và biên nhận sẽ
            được lưu trong lịch sử này.
          </p>
          <span className={accountStyles.accountHistoryPrivacy}>
            Mỗi giao dịch sẽ hiển thị rõ số tiền, trạng thái và mã tham chiếu.
          </span>
        </section>
      </div>
    </LocalizedTree>
  );
}
export default function AccountHistoryScreen() {
  return (
    <Protected>
      <History />
    </Protected>
  );
}
