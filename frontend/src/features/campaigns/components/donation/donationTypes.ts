import type { MoneyTarget } from "./FundraisingProgress";

export type DonationSummary = {
  campaignId: string;
  targetAmount: number;
  donatedAmount: number;
  remainingAmount: number;
  confirmedDonationCount: number;
  targets: MoneyTarget[];
  isClosed: boolean;
  moneyAvailability?: "OPEN" | "SCHEDULED" | "CLOSED" | "UNAVAILABLE";
};

export type Donation = {
  id: string;
  campaignId: string;
  budgetItemId: string;
  campaignTitle: string;
  targetName: string;
  amount: number;
  status: string;
  paymentMethod: string;
  reference: string;
  createdAt: string;
  expiresAt: string;
};

export type OtpChallenge = {
  donationId: string;
  reference: string;
  payerAccountLast4: string;
  expiresAt: string;
  testOtp: string | null;
};

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
export const money = (value: number) => currency.format(value);
