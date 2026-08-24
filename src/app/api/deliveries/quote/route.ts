import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { apiError, errorResponse } from "@/lib/apiError";
import { quoteDeliverySchema } from "@/lib/validation";
import { calculatePayment } from "@/lib/payment/calculatePayment";
import { getEffectivePriceList } from "@/lib/priceList/getEffectivePriceList";


export async function POST(req: NextRequest) {
  try {
    await requireSession(); 

    const body = await req.json();
    const parsed = quoteDeliverySchema.safeParse(body);
    if (!parsed.success) {
      throw apiError("VALIDATION_ERROR", "Invalid delivery input.", parsed.error.flatten());
    }
    const { produceType, grade, grossWeightKg, tareWeightKg, deliveryDate } = parsed.data;
    const date = deliveryDate ? new Date(deliveryDate) : new Date();

    const { entry } = await getEffectivePriceList(date, produceType, grade);

    const calculation = calculatePayment(
      { produceType, grade, grossWeightKg, tareWeightKg },
      [{ produceType: entry.produceType, grade: entry.grade, pricePerKgRwf: entry.pricePerKgRwf }]
    );

    if (!calculation.ok) {
      throw apiError(
        calculation.error.code === "INVALID_NET_WEIGHT" ? "INVALID_NET_WEIGHT" : "NO_PRICE_FOR_DATE",
        calculation.error.message
      );
    }

    return NextResponse.json({ quote: calculation });
  } catch (err) {
    return errorResponse(err);
  }
}
