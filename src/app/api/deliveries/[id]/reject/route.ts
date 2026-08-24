import { NextRequest } from "next/server";
import { handleTransition } from "@/lib/delivery/handleTransition";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleTransition(req, params.id, "REJECTED");
}
