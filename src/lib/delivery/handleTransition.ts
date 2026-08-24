import { NextRequest, NextResponse } from "next/server";
import type { DeliveryStatus } from "@prisma/client";
import { requireSession } from "@/lib/session";
import { errorResponse, apiError } from "@/lib/apiError";
import { transitionDeliverySchema } from "@/lib/validation";
import { transitionDelivery } from "@/lib/delivery/transitionDelivery";


export async function handleTransition(
  req: NextRequest,
  deliveryId: string,
  targetStatus: DeliveryStatus
) {
  try {
    const session = await requireSession();

    const body = await req.json().catch(() => ({}));
    const parsed = transitionDeliverySchema.safeParse(body);
    if (!parsed.success) {
      throw apiError("VALIDATION_ERROR", "Invalid request body.", parsed.error.flatten());
    }

    const delivery = await transitionDelivery({
      deliveryId,
      targetStatus,
      session,
      comment: parsed.data.comment ?? null,
    });

    return NextResponse.json({ delivery });
  } catch (err) {
    return errorResponse(err);
  }
}
