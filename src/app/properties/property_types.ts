import type {
  PropertyType,
  OpportunityRating,
  QualificationStatus,
} from "@prisma/client";

export interface ActionResult {
    ok: boolean;
    error?: string;
    id?: string;
}

export interface PropertyDetail {
    id: string;
    name: string;
    propertyType: PropertyType;
    managementCompany: string | null;
    streetAddress: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    phone: string | null;
    website: string | null;
    numberOfUnits: number | null;
    estimatedResidents: number | null;
    yearBuilt: number | null;
    createdAt: Date;
    updatedAt: Date;
    contacts: {
        id: string;
        propertyId: string;
        role: string;
        name: string | null;
        email: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[];
    existingSystem: {
        id: string;
        propertyId: string;
        callBoxBrand: string | null;
        callBoxModel: string | null;
        callBoxQuantity: number | null;
        accessControlBrand: string | null;
        accessControlModel: string | null;
        surveillanceBrand: string | null;
        surveillanceModel: string | null;
        credentials: any;
        createdAt: Date;
        updatedAt: Date;
    } | null;
    deviceCount: {
        id: string;
        propertyId: string;
        accessControlledDoors: number | null;
        additionalDoorsToSecure: number | null;
        vehicleGates: number | null;
        pedestrianGates: number | null;
        garageDoors: number | null;
        adaDoorOperators: number | null;
        cameras: number | null;
        createdAt: Date;
        updatedAt: Date;
    } | null;
    opportunity: {
        id: string;
        propertyId: string;
        butterflyMxRating: OpportunityRating;
        invisibleIntercomRating: OpportunityRating;
        opportunityNotes: string | null;
        qualificationStatus: QualificationStatus;
        nextFollowUpDate: Date | null;
        internalNotes: string | null;
        createdAt: Date;
        updatedAt: Date;
        followUps: {
            id: string;
            opportunityId: string;
            contactedBy: string | null;
            contactMethod: string | null;
            notes: string | null;
            nextFollowUpDate: Date | null;
            createdAt: Date;
        }[];
    } | null;
    emailHistory: {
        id: string;
        storedEmail: {
            id: string;
            messageId: string | null;
            direction: string;
            fromAddress: string;
            fromName: string | null;
            toAddress: string | null;
            subject: string | null;
            bodyText: string;
            receivedAt: Date;
        };
    }[];
}

export interface CreatePropertyInput {
    name: string;
    propertyType: PropertyType;
    managementCompany?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    phone?: string;
    website?: string;
    contacts: {
        role: "PROPERTY_MANAGER" | "MAINTENANCE_MANAGER" | "REGIONAL_MANAGER";
        name?: string;
        email?: string;
        phone?: string;
    }[];
    numberOfUnits?: number | null;
    estimatedResidents?: number | null;
    yearBuilt?: number | null;
    callBoxBrand?: string;
    callBoxModel?: string;
    callBoxQuantity?: number | null;
    accessControlBrand?: string;
    accessControlModel?: string;
    surveillanceBrand?: string;
    surveillanceModel?: string;
    credentials?: string[];
    accessControlledDoors?: number | null;
    additionalDoorsToSecure?: number | null;
    vehicleGates?: number | null;
    pedestrianGates?: number | null;
    garageDoors?: number | null;
    adaDoorOperators?: number | null;
    cameras?: number | null;
    butterflyMxRating?: OpportunityRating;
    invisibleIntercomRating?: OpportunityRating;
    opportunityNotes?: string;
    qualificationStatus?: QualificationStatus;
    nextFollowUpDate?: string | null;
    internalNotes?: string;
}
