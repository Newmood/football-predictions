import { NextResponse } from "next/server";
import { fetchLiveBracketData } from "@/lib/live-bracket";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bracket = await fetchLiveBracketData();
    return NextResponse.json(bracket);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unknown bracket fetch error."
      },
      { status: 502 }
    );
  }
}
