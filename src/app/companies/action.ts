"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";

export interface ActionResult {
    ok: boolean;
    error?: string;
    id?: string;
}

/** Create or find a standalone company by name and domain. Returns company ID. */
export async function createCompany(input: {
    name: string;
    domain: string;
}): Promise<ActionResult> {
    const name = input.name.trim();
    const domain = input.domain.trim().toLowerCase();

    if (!domain) {
        return { ok: false, error: "Domain is required." };
    }

    const existing = await prisma.company.findUnique({
        where: { domain },
    });

    if (existing) {
        return { ok: true, id: existing.id };
    }

    try {
        const created = await prisma.company.create({
            data: {
                name: name || domain,
                domain,
            },
        });
        revalidatePath("/companies");
        return { ok: true, id: created.id };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
