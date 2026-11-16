import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import type { CampaignManagementModel } from "@/features/campaigns/management/hooks/useCampaignManagement";
import managementStyles from "@/features/campaigns/management/CampaignManagement.module.css";

type Props = Pick<
  CampaignManagementModel,
  | "bankSearch"
  | "bankStatus"
  | "banks"
  | "expenses"
  | "id"
  | "methods"
  | "otherBank"
  | "selectedBank"
  | "setBankRetry"
  | "setBankSearch"
  | "setExpenses"
  | "setMethods"
  | "setOtherBank"
  | "setSelectedBank"
  | "setStep"
  | "step"
  | "submittedDetails"
>;

export default function CampaignFundingStep({
  bankSearch,
  bankStatus,
  banks,

  expenses,
  id,
  methods,

  otherBank,
  selectedBank,
  setBankRetry,
  setBankSearch,
  setExpenses,
  setMethods,
  setOtherBank,
  setSelectedBank,
  setStep,
  step,
  submittedDetails,
}: Props) {
  return (
    <LocalizedTree>
      <div hidden={step !== 2} data-campaign-step-two>
        <h3>Mục tiêu chiến dịch</h3>
        <h4>1. Dự toán chi phí</h4>
        {expenses.map((expense, index) => (
          <div className={managementStyles.expense} key={expense.id}>
            <div className={managementStyles.expenseHeading}>
              <strong>Khoản chi {index + 1}</strong>
              {expenses.length > 1 && (
                <button
                  type="button"
                  className={`quiet ${managementStyles.expenseRemove}`}
                  onClick={() =>
                    setExpenses((items) => items.filter((item) => item.id !== expense.id))
                  }
                  aria-label={`Xóa khoản chi ${index + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
            <label>
              <span>
                Tên khoản chi{" "}
                <span className={managementStyles.required} aria-hidden="true">
                  *
                </span>
              </span>
              <input
                required={step === 2}
                value={expense.name}
                maxLength={200}
                onChange={(e) =>
                  setExpenses((items) =>
                    items.map((item) =>
                      item.id === expense.id ? { ...item, name: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              <span>
                Số tiền dự kiến (VND){" "}
                <span className={managementStyles.required} aria-hidden="true">
                  *
                </span>
              </span>
              <input
                type="number"
                min="1"
                step="1"
                required={step === 2}
                value={expense.amount}
                onChange={(e) =>
                  setExpenses((items) =>
                    items.map((item) =>
                      item.id === expense.id ? { ...item, amount: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              <span>
                Mô tả chi tiết mục đích sử dụng{" "}
                <span className={managementStyles.required} aria-hidden="true">
                  *
                </span>
              </span>
              <textarea
                required={step === 2}
                value={expense.description}
                maxLength={4000}
                onChange={(e) =>
                  setExpenses((items) =>
                    items.map((item) =>
                      item.id === expense.id ? { ...item, description: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className={`secondary ${managementStyles.expenseAdd}`}
          onClick={() =>
            setExpenses((items) => [
              ...items,
              {
                id: Math.max(...items.map((item) => item.id)) + 1,
                name: "",
                amount: "",
                description: "",
              },
            ])
          }
        >
          + Thêm khoản chi phí
        </button>
        <div className={managementStyles.expenseTotal}>
          <strong>Tổng mục tiêu quyên góp</strong>
          <strong>
            {expenses
              .reduce((total, item) => total + (Number(item.amount) || 0), 0)
              .toLocaleString("vi-VN")}{" "}
            đ
          </strong>
        </div>
        <h4>2. Phương thức nhận tài trợ</h4>
        <div className={managementStyles.fundingOptions}>
          {["Chuyển khoản ngân hàng", "Mã QR ngân hàng", "Nhận hiện vật"].map((method) => (
            <label key={method}>
              <input
                type="checkbox"
                checked={methods.includes(method)}
                onChange={(e) =>
                  setMethods((items) =>
                    e.target.checked ? [...items, method] : items.filter((item) => item !== method),
                  )
                }
              />
              {method}
            </label>
          ))}
        </div>
        <section
          className={managementStyles.bankAccount}
          hidden={!methods.includes("Chuyển khoản ngân hàng")}
        >
          <h4>Thông tin tài khoản nhận quyên góp</h4>
          <fieldset className={managementStyles.bankOptions}>
            <legend>
              Ngân hàng{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </legend>
            <details className={managementStyles.bankDropdown}>
              <summary>
                <span>{selectedBank || "Chọn ngân hàng"}</span>
              </summary>
              <div className={managementStyles.bankList}>
                <div className={managementStyles.bankSearch}>
                  <input
                    type="search"
                    aria-label="Tìm ngân hàng"
                    placeholder="Tìm tên hoặc mã ngân hàng"
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                  />
                </div>
                {bankStatus === "loading" && (
                  <p className={managementStyles.bankMessage}>Đang tải danh sách ngân hàng…</p>
                )}
                {bankStatus === "error" && (
                  <div className={managementStyles.bankMessage} role="alert">
                    Không tải được danh sách ngân hàng.{" "}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setBankRetry((n) => n + 1)}
                    >
                      Thử lại
                    </button>
                  </div>
                )}
                {banks.map((bank) => (
                  <label
                    className={managementStyles.bankOption}
                    key={bank.code}
                    hidden={
                      !!bankSearch.trim() &&
                      !`${bank.shortName} ${bank.name} ${bank.code}`
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/đ/gi, "d")
                        .toLowerCase()
                        .includes(
                          bankSearch
                            .trim()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/đ/gi, "d")
                            .toLowerCase(),
                        )
                    }
                  >
                    <input
                      type="radio"
                      name="bankName"
                      value={bank.shortName}
                      checked={selectedBank === bank.shortName}
                      required={step === 2 && methods.includes("Chuyển khoản ngân hàng")}
                      onChange={(e) => {
                        setSelectedBank(bank.shortName);
                        setOtherBank(false);
                        const dropdown = e.currentTarget.closest("details");
                        if (dropdown) dropdown.open = false;
                      }}
                    />
                    <img
                      src={bank.logo}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.hidden = true;
                      }}
                    />
                    <span>{bank.shortName}</span>
                  </label>
                ))}
                {bankStatus === "ready" &&
                  bankSearch.trim() &&
                  !banks.some((bank) =>
                    `${bank.shortName} ${bank.name} ${bank.code}`
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/đ/gi, "d")
                      .toLowerCase()
                      .includes(
                        bankSearch
                          .trim()
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .replace(/đ/gi, "d")
                          .toLowerCase(),
                      ),
                  ) && (
                    <p className={managementStyles.bankMessage}>
                      Không tìm thấy ngân hàng phù hợp.
                    </p>
                  )}
                <label className={managementStyles.bankOption}>
                  <input
                    type="radio"
                    name="bankName"
                    value="Ngân hàng khác"
                    checked={selectedBank === "Ngân hàng khác"}
                    required={step === 2 && methods.includes("Chuyển khoản ngân hàng")}
                    onChange={(e) => {
                      setSelectedBank("Ngân hàng khác");
                      setOtherBank(true);
                      const dropdown = e.currentTarget.closest("details");
                      if (dropdown) dropdown.open = false;
                    }}
                  />
                  <span>Ngân hàng khác</span>
                </label>
              </div>
            </details>
          </fieldset>
          <label hidden={!otherBank}>
            <span>
              Tên ngân hàng{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <input
              name="otherBankName"
              defaultValue={submittedDetails?.bank?.otherName || ""}
              required={step === 2 && methods.includes("Chuyển khoản ngân hàng") && otherBank}
              maxLength={200}
              placeholder="Nhập tên ngân hàng"
            />
          </label>
          <label>
            <span>
              Tên chủ tài khoản{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <input
              name="bankAccountHolder"
              defaultValue={submittedDetails?.bank?.accountHolder || ""}
              required={step === 2 && methods.includes("Chuyển khoản ngân hàng")}
              maxLength={200}
              placeholder="Nhập tên chủ tài khoản"
            />
          </label>
          <label>
            <span>
              Số tài khoản{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <input
              name="bankAccountNumber"
              defaultValue={submittedDetails?.bank?.accountNumber || ""}
              required={step === 2 && methods.includes("Chuyển khoản ngân hàng")}
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6,30}"
              maxLength={30}
              title="Nhập số tài khoản gồm 6 đến 30 chữ số"
              placeholder="Nhập số tài khoản"
            />
          </label>
        </section>
        <div className={managementStyles.campaignQr} hidden={!methods.includes("Mã QR ngân hàng")}>
          <strong>Mã QR ngân hàng</strong>
          <img src="/campaign-bank-qr.jpg" alt="Mã QR ngân hàng được cung cấp" />
          <small>Mã QR tài khoản được cung cấp cho bản demo.</small>
        </div>
        <div hidden={!methods.includes("Nhận hiện vật")}>
          <h4>Địa chỉ và nhu cầu nhận hiện vật</h4>
          <label>
            <span>
              Loại hiện vật cần quyên góp{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              name="goodsDescription"
              defaultValue={submittedDetails?.goods?.description || ""}
              required={step === 2 && methods.includes("Nhận hiện vật")}
              maxLength={4000}
            />
          </label>
          <label>
            Số lượng mục tiêu(kg)
            <input
              name="goodsTarget"
              type="number"
              min="1"
              step="1"
              defaultValue={submittedDetails?.goods?.target || ""}
            />
          </label>
          <label>
            <span>
              Địa chỉ tiếp nhận chi tiết{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              name="goodsAddress"
              defaultValue={submittedDetails?.goods?.address || ""}
              required={step === 2 && methods.includes("Nhận hiện vật")}
              maxLength={1000}
              placeholder="Số nhà, đường, thôn/tổ dân phố…"
            />
          </label>
        </div>
        <section className={managementStyles.transparency}>
          <h4>3. Cam kết minh bạch</h4>
          <label>
            <span>
              Nội dung cam kết công khai thu chi{" "}
              <span className={managementStyles.required} aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              name="transparencyCommitment"
              defaultValue={submittedDetails?.transparencyCommitment || ""}
              required={step === 2}
              maxLength={4000}
              rows={4}
              placeholder="Nhập cam kết công khai thu chi của tổ chức"
            />
          </label>
        </section>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setStep(1)}>
            ← Quay lại
          </button>
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (!form) return;
              const controls = form.querySelectorAll<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >(
                "[data-campaign-step-two] input, [data-campaign-step-two] textarea, [data-campaign-step-two] select",
              );
              for (const control of controls) {
                if (control.closest("[hidden]") || control.disabled) continue;
                if (!control.checkValidity()) {
                  const dropdown = control.closest("details");
                  if (dropdown) dropdown.open = true;
                  control.reportValidity();
                  return;
                }
              }
              setStep(3);
            }}
          >
            Tiếp theo →
          </button>
        </div>
      </div>
    </LocalizedTree>
  );
}
