import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  void req;
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use Firebase Auth on the client and send Firebase ID token as Bearer token."
    },
    { status: 410 }
  );
}
