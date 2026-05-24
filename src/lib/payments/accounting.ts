export type AccountingPaymentMethod = "Cash" | "UPI Gateway";

export type PaymentAccountingTransaction = {
  id: string;
  reservationId: string | null;
  bookingId: string | null;
  description: string;
  amount: number;
  paymentMethod: AccountingPaymentMethod;
  timestamp: string;
  reference: string | null;
  receivedBy: string | null;
  receivedByName: string | null;
  source: string | null;
};

export type CashReceiverSummary = {
  receivedBy: string | null;
  receivedByName: string;
  amount: number;
  count: number;
};

export type PaymentAccountingSummary = {
  onlineTotal: number;
  cashTotal: number;
  total: number;
  onlineCount: number;
  cashCount: number;
  cashByReceiver: CashReceiverSummary[];
};

export function summarizeAccountingTransactions(
  transactions: PaymentAccountingTransaction[]
): PaymentAccountingSummary {
  let onlineTotal = 0;
  let cashTotal = 0;
  let onlineCount = 0;
  let cashCount = 0;
  const cashByReceiver = new Map<string, CashReceiverSummary>();

  for (const transaction of transactions) {
    const amount = normalizeMoney(Math.abs(transaction.amount));

    if (transaction.paymentMethod === "UPI Gateway") {
      onlineTotal += amount;
      onlineCount += 1;
      continue;
    }

    cashTotal += amount;
    cashCount += 1;

    const receiverKey = transaction.receivedBy ?? "unassigned";
    const current =
      cashByReceiver.get(receiverKey) ??
      {
        receivedBy: transaction.receivedBy,
        receivedByName: transaction.receivedByName?.trim() || "Unassigned",
        amount: 0,
        count: 0,
      };

    current.amount = normalizeMoney(current.amount + amount);
    current.count += 1;
    cashByReceiver.set(receiverKey, current);
  }

  return {
    onlineTotal: normalizeMoney(onlineTotal),
    cashTotal: normalizeMoney(cashTotal),
    total: normalizeMoney(onlineTotal + cashTotal),
    onlineCount,
    cashCount,
    cashByReceiver: Array.from(cashByReceiver.values()).sort(
      (left, right) => right.amount - left.amount
    ),
  };
}

function normalizeMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
