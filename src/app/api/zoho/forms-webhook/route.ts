import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { zohoFormWebhookSchema, type ZohoFormWebhookInput } from "../../../../lib/schemas/zoho-forms";
import { createProperty } from "../../../../app/properties/actions";
import type { CreatePropertyInput } from "../../../../app/properties/property_types";
import { prisma } from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isAuthorizedWebhook(request: NextRequest): boolean {
  const secret = process.env.ZOHO_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[Zoho Forms Webhook] ZOHO_WEBHOOK_SECRET is not set — rejecting. Set it and " +
        "append ?secret=<value> to the webhook URL configured in Zoho."
    );
    return false;
  }
  const provided =
    new URL(request.url).searchParams.get("secret") ??
    request.headers.get("x-webhook-secret") ??
    "";
  return safeEqual(provided, secret);
}

async function claimWebhook(dedupKey: string): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({ data: { messageId: dedupKey } });
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return false;
    }
    console.warn("[Zoho Forms Webhook] dedup claim errored; processing anyway:", err);
    return true;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ ok: true, message: "Zoho forms webhook endpoint is live" });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.text();
  let json: unknown;

  console.log("asdfasdfasdf",raw);
   
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn("[Zoho Forms Webhook] body is not JSON:", raw.slice(0, 200));
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = zohoFormWebhookSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("[Zoho Forms Webhook] validation failed:", parsed.error.message);
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }

  const input: ZohoFormWebhookInput = parsed.data;

  // Deduplication if submission/record id is provided
  const idToDedup = input.submissionId || input.recordId;
  if (idToDedup) {
    const dedupKey = `form-sub-${idToDedup}`;
    if (!(await claimWebhook(dedupKey))) {
      console.log(`[Zoho Forms Webhook] duplicate submission ${idToDedup} - skipping`);
      return NextResponse.json({ ok: true, message: "Duplicate submission (already processed)" });
    }
  }

  console.log("\n========== [Zoho Forms Webhook] new form submission ==========");
  console.log(`  property name: ${input.name}`);
  console.log(`  property type: ${input.propertyType}`);

  // Build the contacts array for CreatePropertyInput
  const contacts: CreatePropertyInput["contacts"] = [];
  if (input.pmName || input.pmEmail || input.pmPhone) {
    contacts.push({
      role: "PROPERTY_MANAGER",
      name: input.pmName || undefined,
      email: input.pmEmail || undefined,
      phone: input.pmPhone || undefined,
    });
  }
  if (input.mmName || input.mmEmail || input.mmPhone) {
    contacts.push({
      role: "MAINTENANCE_MANAGER",
      name: input.mmName || undefined,
      email: input.mmEmail || undefined,
      phone: input.mmPhone || undefined,
    });
  }
  if (input.rmName || input.rmEmail || input.rmPhone) {
    contacts.push({
      role: "REGIONAL_MANAGER",
      name: input.rmName || undefined,
      email: input.rmEmail || undefined,
      phone: input.rmPhone || undefined,
    });
  }

  const propertyData: CreatePropertyInput = {
    name: input.name,
    propertyType: input.propertyType,
    managementCompany: input.managementCompany || undefined,
    streetAddress: input.streetAddress || undefined,
    city: input.city || undefined,
    state: input.state || undefined,
    zipCode: input.zipCode || undefined,
    phone: input.phone || undefined,
    website: input.website || undefined,
    contacts,
    numberOfUnits: input.numberOfUnits ?? null,
    estimatedResidents: input.estimatedResidents ?? null,
    yearBuilt: input.yearBuilt ?? null,
    callBoxBrand: input.callBoxBrand || undefined,
    callBoxModel: input.callBoxModel || undefined,
    callBoxQuantity: input.callBoxQuantity ?? null,
    accessControlBrand: input.accessControlBrand || undefined,
    accessControlModel: input.accessControlModel || undefined,
    surveillanceBrand: input.surveillanceBrand || undefined,
    surveillanceModel: input.surveillanceModel || undefined,
    credentials: input.credentials || undefined,
    accessControlledDoors: input.accessControlledDoors ?? null,
    additionalDoorsToSecure: input.additionalDoorsToSecure ?? null,
    vehicleGates: input.vehicleGates ?? null,
    pedestrianGates: input.pedestrianGates ?? null,
    garageDoors: input.garageDoors ?? null,
    adaDoorOperators: input.adaDoorOperators ?? null,
    cameras: input.cameras ?? null,
    butterflyMxRating: input.butterflyMxRating,
    invisibleIntercomRating: input.invisibleIntercomRating,
    opportunityNotes: input.opportunityNotes || undefined,
    qualificationStatus: input.qualificationStatus,
    nextFollowUpDate: input.nextFollowUpDate,
    internalNotes: input.internalNotes || undefined,
  };

  const result = await createProperty(propertyData);

  if (!result.ok) {
    console.error("[Zoho Forms Webhook] failed to create property:", result.error);
    return NextResponse.json({ error: result.error || "Failed to create property" }, { status: 500 });
  }

  console.log(`[Zoho Forms Webhook] property created successfully: ${result.id}`);
  console.log("==============================================================\n");

  return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
}
