"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LIGHT } from "../../zoho/_components/ui";
import { useToast } from "../../_components/Toast";
import { createProperty, updateProperty, getPropertyDetails } from "../actions";
import type { CreatePropertyInput, PropertyDetail } from "../property_types";
import { Step1PropertyInfo } from "./steps/Step1PropertyInfo";
import { Step2Contacts } from "./steps/Step2Contacts";
import { Step3Details } from "./steps/Step3Details";
import { Step4ExistingSystems } from "./steps/Step4ExistingSystems";
import { Step5DeviceCounts } from "./steps/Step5DeviceCounts";
import { Step6Opportunity } from "./steps/Step6Opportunity";
import { Step7FollowUp } from "./steps/Step7FollowUp";

// ─── Form State Type ───────────────────────────────────────────────────────────

export interface ContactEntry {
  name: string;
  email: string;
  phone: string;
}

export interface PropertyFormData {
  // Section 1
  name: string;
  propertyType: "APARTMENT" | "MULTIFAMILY" | "HOA" | "CONDO_COMMUNITY" | "";
  managementCompany: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  website: string;

  // Section 2
  propertyManager: ContactEntry;
  maintenanceManager: ContactEntry;
  regionalManager: ContactEntry;

  // Section 3
  numberOfUnits: string;
  estimatedResidents: string;
  yearBuilt: string;

  // Section 4
  callBoxBrand: string;
  callBoxModel: string;
  callBoxQuantity: string;
  accessControlBrand: string;
  accessControlModel: string;
  surveillanceBrand: string;
  surveillanceModel: string;
  credentials: string[];

  // Section 5
  accessControlledDoors: string;
  additionalDoorsToSecure: string;
  vehicleGates: string;
  pedestrianGates: string;
  garageDoors: string;
  adaDoorOperators: string;
  cameras: string;

  // Section 6
  butterflyMxRating: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  invisibleIntercomRating: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  opportunityNotes: string;

  // Section 7
  qualificationStatus:
    | "NEW_PROSPECT"
    | "RESEARCHING"
    | "QUALIFIED"
    | "PROPOSAL_READY"
    | "PROPOSAL_SENT"
    | "CUSTOMER"
    | "LOST";
  nextFollowUpDate: string;
  internalNotes: string;
}

const EMPTY_CONTACT: ContactEntry = { name: "", email: "", phone: "" };

const INITIAL: PropertyFormData = {
  name: "",
  propertyType: "",
  managementCompany: "",
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
  phone: "",
  website: "",
  propertyManager: { ...EMPTY_CONTACT },
  maintenanceManager: { ...EMPTY_CONTACT },
  regionalManager: { ...EMPTY_CONTACT },
  numberOfUnits: "",
  estimatedResidents: "",
  yearBuilt: "",
  callBoxBrand: "",
  callBoxModel: "",
  callBoxQuantity: "",
  accessControlBrand: "",
  accessControlModel: "",
  surveillanceBrand: "",
  surveillanceModel: "",
  credentials: [],
  accessControlledDoors: "",
  additionalDoorsToSecure: "",
  vehicleGates: "",
  pedestrianGates: "",
  garageDoors: "",
  adaDoorOperators: "",
  cameras: "",
  butterflyMxRating: "UNKNOWN",
  invisibleIntercomRating: "UNKNOWN",
  opportunityNotes: "",
  qualificationStatus: "NEW_PROSPECT",
  nextFollowUpDate: "",
  internalNotes: "",
};

// ─── Steps Metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Property Info", icon: "🏢" },
  { label: "Contacts", icon: "👤" },
  { label: "Details", icon: "📐" },
  { label: "Systems", icon: "🔧" },
  { label: "Devices", icon: "🔢" },
  { label: "Opportunity", icon: "🎯" },
  { label: "Follow-Up", icon: "📅" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function numOrNull(v: string): number | null {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function buildInput(data: PropertyFormData): CreatePropertyInput {
  const contacts: CreatePropertyInput["contacts"] = [];
  for (const [role, entry] of [
    ["PROPERTY_MANAGER", data.propertyManager],
    ["MAINTENANCE_MANAGER", data.maintenanceManager],
    ["REGIONAL_MANAGER", data.regionalManager],
  ] as const) {
    contacts.push({ role, ...entry });
  }

  return {
    name: data.name,
    propertyType: data.propertyType as CreatePropertyInput["propertyType"],
    managementCompany: data.managementCompany,
    streetAddress: data.streetAddress,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    phone: data.phone,
    website: data.website,
    contacts,
    numberOfUnits: numOrNull(data.numberOfUnits),
    estimatedResidents: numOrNull(data.estimatedResidents),
    yearBuilt: numOrNull(data.yearBuilt),
    callBoxBrand: data.callBoxBrand,
    callBoxModel: data.callBoxModel,
    callBoxQuantity: numOrNull(data.callBoxQuantity),
    accessControlBrand: data.accessControlBrand,
    accessControlModel: data.accessControlModel,
    surveillanceBrand: data.surveillanceBrand,
    surveillanceModel: data.surveillanceModel,
    credentials: data.credentials,
    accessControlledDoors: numOrNull(data.accessControlledDoors),
    additionalDoorsToSecure: numOrNull(data.additionalDoorsToSecure),
    vehicleGates: numOrNull(data.vehicleGates),
    pedestrianGates: numOrNull(data.pedestrianGates),
    garageDoors: numOrNull(data.garageDoors),
    adaDoorOperators: numOrNull(data.adaDoorOperators),
    cameras: numOrNull(data.cameras),
    butterflyMxRating: data.butterflyMxRating,
    invisibleIntercomRating: data.invisibleIntercomRating,
    opportunityNotes: data.opportunityNotes,
    qualificationStatus: data.qualificationStatus,
    nextFollowUpDate: data.nextFollowUpDate || null,
    internalNotes: data.internalNotes,
  };
}

function validateStep(step: number, data: PropertyFormData): string | null {
  if (step === 0) {
    if (!data.name.trim()) return "Property name is required.";
    if (!data.propertyType) return "Property type is required.";
  }
  return null;
}

// ─── Main Wizard ───────────────────────────────────────────────────────────────

function mapDetailToFormData(detail: PropertyDetail): PropertyFormData {
  const pm = detail.contacts?.find((c: any) => c.role === "PROPERTY_MANAGER") || EMPTY_CONTACT;
  const mm = detail.contacts?.find((c: any) => c.role === "MAINTENANCE_MANAGER") || EMPTY_CONTACT;
  const rm = detail.contacts?.find((c: any) => c.role === "REGIONAL_MANAGER") || EMPTY_CONTACT;

  let credentials: string[] = [];
  if (detail.existingSystem?.credentials) {
    try {
      const creds = detail.existingSystem.credentials;
      credentials = typeof creds === "string" ? JSON.parse(creds) : (Array.isArray(creds) ? creds : []);
    } catch {}
  }

  const dateToStr = (dateString: any) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  return {
    name: detail.name || "",
    propertyType: (detail.propertyType || "") as any,
    managementCompany: detail.managementCompany || "",
    streetAddress: detail.streetAddress || "",
    city: detail.city || "",
    state: detail.state || "",
    zipCode: detail.zipCode || "",
    phone: detail.phone || "",
    website: detail.website || "",
    propertyManager: {
      name: pm.name || "",
      email: pm.email || "",
      phone: pm.phone || "",
    },
    maintenanceManager: {
      name: mm.name || "",
      email: mm.email || "",
      phone: mm.phone || "",
    },
    regionalManager: {
      name: rm.name || "",
      email: rm.email || "",
      phone: rm.phone || "",
    },
    numberOfUnits: detail.numberOfUnits != null ? String(detail.numberOfUnits) : "",
    estimatedResidents: detail.estimatedResidents != null ? String(detail.estimatedResidents) : "",
    yearBuilt: detail.yearBuilt != null ? String(detail.yearBuilt) : "",
    callBoxBrand: detail.existingSystem?.callBoxBrand || "",
    callBoxModel: detail.existingSystem?.callBoxModel || "",
    callBoxQuantity: detail.existingSystem?.callBoxQuantity != null ? String(detail.existingSystem.callBoxQuantity) : "",
    accessControlBrand: detail.existingSystem?.accessControlBrand || "",
    accessControlModel: detail.existingSystem?.accessControlModel || "",
    surveillanceBrand: detail.existingSystem?.surveillanceBrand || "",
    surveillanceModel: detail.existingSystem?.surveillanceModel || "",
    credentials,
    accessControlledDoors: detail.deviceCount?.accessControlledDoors != null ? String(detail.deviceCount.accessControlledDoors) : "",
    additionalDoorsToSecure: detail.deviceCount?.additionalDoorsToSecure != null ? String(detail.deviceCount.additionalDoorsToSecure) : "",
    vehicleGates: detail.deviceCount?.vehicleGates != null ? String(detail.deviceCount.vehicleGates) : "",
    pedestrianGates: detail.deviceCount?.pedestrianGates != null ? String(detail.deviceCount.pedestrianGates) : "",
    garageDoors: detail.deviceCount?.garageDoors != null ? String(detail.deviceCount.garageDoors) : "",
    adaDoorOperators: detail.deviceCount?.adaDoorOperators != null ? String(detail.deviceCount.adaDoorOperators) : "",
    cameras: detail.deviceCount?.cameras != null ? String(detail.deviceCount.cameras) : "",
    butterflyMxRating: detail.opportunity?.butterflyMxRating || "UNKNOWN",
    invisibleIntercomRating: detail.opportunity?.invisibleIntercomRating || "UNKNOWN",
    opportunityNotes: detail.opportunity?.opportunityNotes || "",
    qualificationStatus: detail.opportunity?.qualificationStatus || "NEW_PROSPECT",
    nextFollowUpDate: dateToStr(detail.opportunity?.nextFollowUpDate),
    internalNotes: detail.opportunity?.internalNotes || "",
  };
}

export interface PropertyFormWizardProps {
  propertyId?: string;
}

export function PropertyFormWizard({ propertyId }: PropertyFormWizardProps = {}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<PropertyFormData>(INITIAL);
  const [loading, setLoading] = useState(!!propertyId);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    const fetchProp = async () => {
      const res = await getPropertyDetails(propertyId);
      if (!res.ok || !res.property) {
        toast.error(res.error ?? "Failed to load property details.");
        setLoading(false);
        return;
      }
      setData(mapDetailToFormData(res.property as unknown as PropertyDetail));
      setLoading(false);
    };
    fetchProp();
  }, [propertyId, toast]);

  function patch(delta: Partial<PropertyFormData>) {
    setData((prev) => ({ ...prev, ...delta }));
  }

  function goNext() {
    const err = validateStep(step, data);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    startTransition(async () => {
      const input = buildInput(data);
      const res = propertyId
        ? await updateProperty(propertyId, input)
        : await createProperty(input);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save property.");
        return;
      }
      toast.success(propertyId ? "Property updated successfully!" : "Property saved successfully!");
      router.push("/properties");
    });
  }

  const isLast = step === STEPS.length - 1;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 1rem" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${LIGHT.border}`, borderTopColor: LIGHT.accent, animation: "spin 0.8s linear infinite" }} />
        <div style={{ marginTop: "1rem", color: LIGHT.textSecondary, fontSize: "0.88rem" }}>
          Loading property details for edit...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 820,
        width: "100%",
        margin: "0 auto",
        padding: "0 1rem 4rem",
        boxSizing: "border-box",
      }}
    >
      {/* ── Progress Bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginBottom: "2.5rem",
          overflowX: "auto",
          paddingBottom: "0.25rem",
        }}
      >
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              {/* Step bubble */}
              <button
                type="button"
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                disabled={i > step || pending}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "none",
                  border: "none",
                  cursor: i < step ? "pointer" : "default",
                  padding: "0 0.25rem",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: done ? "1rem" : "0.85rem",
                    fontWeight: 700,
                    border: `2px solid ${active ? LIGHT.accent : done ? LIGHT.success : LIGHT.border}`,
                    background: active
                      ? LIGHT.accent
                      : done
                        ? LIGHT.successSoft
                        : LIGHT.panel,
                    color: active ? "#fff" : done ? LIGHT.success : LIGHT.textMuted,
                    transition: "all 0.2s ease",
                    boxShadow: active ? "0 0 0 3px rgba(37,99,235,0.2)" : "none",
                  }}
                >
                  {done ? "✓" : s.icon}
                </div>
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: active ? 700 : 500,
                    color: active ? LIGHT.accent : done ? LIGHT.success : LIGHT.textMuted,
                    whiteSpace: "nowrap",
                    maxWidth: 72,
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {s.label}
                </span>
              </button>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    width: 36,
                    height: 2,
                    background: i < step ? LIGHT.success : LIGHT.border,
                    flexShrink: 0,
                    marginBottom: 20,
                    transition: "background 0.2s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Form Card ── */}
      <div
        style={{
          background: LIGHT.panel,
          border: `1px solid ${LIGHT.border}`,
          borderRadius: 16,
          padding: "2rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          animation: "slideUp 0.25s ease",
        }}
      >
        {step === 0 && <Step1PropertyInfo data={data} onChange={patch} />}
        {step === 1 && <Step2Contacts data={data} onChange={patch} />}
        {step === 2 && <Step3Details data={data} onChange={patch} />}
        {step === 3 && <Step4ExistingSystems data={data} onChange={patch} />}
        {step === 4 && <Step5DeviceCounts data={data} onChange={patch} />}
        {step === 5 && <Step6Opportunity data={data} onChange={patch} />}
        {step === 6 && <Step7FollowUp data={data} onChange={patch} />}
      </div>

      {/* ── Navigation ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1.5rem",
          gap: "1rem",
        }}
      >
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || pending}
          style={{
            padding: "0.65rem 1.4rem",
            borderRadius: 10,
            border: `1px solid ${LIGHT.border}`,
            background: LIGHT.panel,
            color: step === 0 ? LIGHT.textMuted : LIGHT.textSecondary,
            fontSize: "0.88rem",
            fontWeight: 600,
            cursor: step === 0 || pending ? "not-allowed" : "pointer",
            opacity: step === 0 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          ← Back
        </button>

        <span
          style={{
            fontSize: "0.78rem",
            color: LIGHT.textMuted,
          }}
        >
          Step {step + 1} of {STEPS.length}
        </span>

        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            style={{
              padding: "0.65rem 1.6rem",
              borderRadius: 10,
              border: "none",
              background: pending ? LIGHT.textMuted : LIGHT.success,
              color: "#fff",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: pending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              boxShadow: pending ? "none" : "0 2px 8px rgba(22,163,74,0.3)",
            }}
          >
            {pending ? "Saving…" : propertyId ? "✓ Save Changes" : "✓ Save Property"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={pending}
            style={{
              padding: "0.65rem 1.6rem",
              borderRadius: 10,
              border: "none",
              background: LIGHT.accent,
              color: "#fff",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
            }}
          >
            Next →
          </button>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
