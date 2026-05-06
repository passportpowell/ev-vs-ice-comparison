import { NextResponse } from "next/server";

import {
  classifyConnectorImage,
  classifySampleByName,
} from "@/lib/connector-classifier";

export const dynamic = "force-dynamic";
// onnxruntime-node is a native binding — must run on Node, not Edge.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sample = url.searchParams.get("sample");
  if (!sample) {
    return NextResponse.json(
      {
        error:
          "Provide ?sample=<filename without extension>, or POST a PNG body.",
        available_samples_path: "/images/cv/samples/",
      },
      { status: 400 }
    );
  }

  try {
    const prediction = await classifySampleByName(sample);
    return NextResponse.json(prediction, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Inference failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/png")) {
    return NextResponse.json(
      {
        error:
          "POST a PNG image with Content-Type: image/png. The CNN was trained on 64x64 RGB inputs.",
      },
      { status: 415 }
    );
  }

  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const prediction = await classifyConnectorImage(buffer);
    return NextResponse.json(prediction);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Inference failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
