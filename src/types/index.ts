export type Role = "CLERK" | "MANAGER" | "ADMIN";
export type ProduceType = "COFFEE_CHERRIES" | "MAIZE" | "BEANS";
export type Grade = "A" | "B" | "C";
export type DeliveryStatus = "RECORDED" | "VERIFIED" | "PAID" | "REJECTED";
export type MembershipStatus = "ACTIVE" | "SUSPENDED";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  centreId: string | null;
}

export interface Centre {
  id: string;
  name: string;
  location: string;
}

export interface Farmer {
  id: string;
  membershipNumber: string;
  name: string;
  phone: string | null;
  membershipStatus: MembershipStatus;
}

export interface DeliveryListItem {
  id: string;
  produceType: ProduceType;
  grade: Grade;
  netWeightKg: string | number;
  amountRwf: number;
  status: DeliveryStatus;
  deliveryDate: string;
  farmer: { id: string; name: string; membershipNumber: string };
  centre: { id: string; name: string };
  recordedBy: { id: string; name: string };
}

export interface DeliveryQuote {
  netWeightKg: number;
  pricePerKgRwf: number;
  amountRwf: number;
}

export const PRODUCE_LABELS: Record<ProduceType, string> = {
  COFFEE_CHERRIES: "Coffee cherries",
  MAIZE: "Maize",
  BEANS: "Beans",
};

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  RECORDED: "Recorded",
  VERIFIED: "Verified",
  PAID: "Paid",
  REJECTED: "Rejected",
};


export function formatRwf(amount: number): string {
  return new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(amount) + " RWF";
}


export function formatKg(weight: string | number): string {
  const n = typeof weight === "string" ? Number(weight) : weight;
  return `${n.toFixed(n % 1 === 0 ? 0 : 3)} kg`;
}
