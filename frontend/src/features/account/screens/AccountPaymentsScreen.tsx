"use client";

import accountStyles from "@/features/account/Account.module.css";
import Protected from "@/features/auth/components/Protected";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
function Payments() {
  return (
    <LocalizedTree>
      <div className={accountStyles.accountSubpage}>
        <header className={accountStyles.accountPageHeading}>
          <p className={accountStyles.userProfileKicker}>ĐÓNG GÓP AN TOÀN</p>
          <h1>Thanh toán</h1>
          <p>Quản lý phương thức thanh toán và theo dõi số tiền đóng góp.</p>
        </header>
        <section className={accountStyles.accountBalanceCard}>
          <span>SỐ DƯ GIVE-AID</span>
          <strong>Chưa khả dụng</strong>
          <p>Ví và số dư sẽ hiển thị khi hệ thống thanh toán được kết nối.</p>
        </section>
        <section className={`${accountStyles.accountSubcard} ${accountStyles.accountBankCard}`}>
          <span className={accountStyles.accountSubcardMark}>₫</span>
          <div>
            <h2>Tài khoản ngân hàng</h2>
            <p>Chưa có tài khoản ngân hàng được liên kết.</p>
            <small>
              Thông tin ngân hàng sẽ được mã hóa và chỉ dùng cho các giao dịch bạn xác nhận.
            </small>
          </div>
          <button disabled title="Tích hợp cổng thanh toán chưa được cấu hình">
            Liên kết ngân hàng
          </button>
        </section>
        <section className={accountStyles.accountPaymentInfo}>
          <h2>Thanh toán chiến dịch</h2>
          <p>
            Hiện chưa có giao dịch hoặc số dư nào được ghi nhận. Khi cổng thanh toán được cấu hình,
            bạn có thể xác nhận từng khoản đóng góp và xem biên nhận tại đây.
          </p>
          <span>Không có khoản tiền nào được trừ khi bạn xác nhận giao dịch.</span>
        </section>
      </div>
    </LocalizedTree>
  );
}
export default function AccountPaymentsScreen() {
  return (
    <Protected>
      <Payments />
    </Protected>
  );
}
