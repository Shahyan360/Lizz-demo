import { ZohoService } from "./zoho.service";
import {
  zohoBooksItemsResponseSchema,
  zohoBooksContactsResponseSchema,
  zohoBooksContactCreateResponseSchema,
  zohoBooksEstimateCreateResponseSchema,
  type ZohoBooksItem,
  type ZohoBooksEstimate,
} from "../lib/schemas/zoho-books";

export class ZohoBooksService {
  private static booksDomain(): string {
    // Allows overriding via env if they use a non-US domain (e.g. zohoapis.eu)
    const booksDomain = process.env.ZOHO_BOOKS_DOMAIN?.trim();
    if (booksDomain) {
      return booksDomain.replace(/^[a-z]+:\/\//i, "").replace(/\/$/, "");
    }
    return "www.zohoapis.com";
  }

  private static getOrgId(): string {
    const orgId = process.env.ZOHO_BOOKS_ORGANIZATION_ID?.trim();
    if (!orgId) {
      throw new Error("ZOHO_BOOKS_ORGANIZATION_ID is not configured in the environment.");
    }
    return orgId;
  }

  /**
   * Retrieves active items from Zoho Books.
   */
  public static async getItems(): Promise<ZohoBooksItem[]> {
    const orgId = this.getOrgId();
    const url = `https://${this.booksDomain()}/books/v3/items?organization_id=${orgId}&status=active`;

    const attempt = async (forceRefresh: boolean): Promise<Response> => {
      const activeToken = await ZohoService.getActiveAccessToken(forceRefresh);
      return fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Zoho-oauthtoken ${activeToken}`,
          "X-com-zoho-books-organizationid": orgId,
          Accept: "application/json",
        },
        cache: "no-store",
      });
    };

    let res = await attempt(false);

    if (res.status === 401) {
      console.log("[ZohoBooksService] 401 — refreshing token and retrying once");
      res = await attempt(true);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Zoho Books API GET /items failed with status ${res.status}: ${text}`
      );
    }

    const data = await res.json();
    const parsed = zohoBooksItemsResponseSchema.parse(data);
    return parsed.items;
  }

  /**
   * Finds a contact by email or creates a new one if not found. Returns the contact_id.
   */
  public static async findOrCreateContact(name: string, email: string): Promise<string> {
    const orgId = this.getOrgId();
    const cleanEmail = email.trim();
    const searchUrl = `https://${this.booksDomain()}/books/v3/contacts?email=${encodeURIComponent(cleanEmail)}&organization_id=${orgId}`;

    const searchAttempt = async (forceRefresh: boolean): Promise<Response> => {
      const activeToken = await ZohoService.getActiveAccessToken(forceRefresh);
      return fetch(searchUrl, {
        method: "GET",
        headers: {
          Authorization: `Zoho-oauthtoken ${activeToken}`,
          "X-com-zoho-books-organizationid": orgId,
          Accept: "application/json",
        },
        cache: "no-store",
      });
    };

    let searchRes = await searchAttempt(false);
    if (searchRes.status === 401) {
      searchRes = await searchAttempt(true);
    }

    if (!searchRes.ok) {
      const text = await searchRes.text().catch(() => "");
      throw new Error(`Zoho Books contact lookup failed with status ${searchRes.status}: ${text}`);
    }

    const searchData = await searchRes.json();
    const parsedSearch = zohoBooksContactsResponseSchema.parse(searchData);

    if (parsedSearch.contacts.length > 0 && parsedSearch.contacts[0].contact_id) {
      return parsedSearch.contacts[0].contact_id;
    }

    // Create new contact
    const createUrl = `https://${this.booksDomain()}/books/v3/contacts?organization_id=${orgId}`;
    const createAttempt = async (forceRefresh: boolean): Promise<Response> => {
      const activeToken = await ZohoService.getActiveAccessToken(forceRefresh);
      return fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${activeToken}`,
          "X-com-zoho-books-organizationid": orgId,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          contact_name: name.trim(),
          email: cleanEmail,
        }),
        cache: "no-store",
      });
    };

    let createRes = await createAttempt(false);
    if (createRes.status === 401) {
      createRes = await createAttempt(true);
    }

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => "");
      if (text.includes("3062") || text.toLowerCase().includes("already exists")) {
        console.log(`[ZohoBooksService] Contact name "${name}" already exists. Retrying with email appended.`);
        const activeToken = await ZohoService.getActiveAccessToken(false);
        const retryRes = await fetch(createUrl, {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${activeToken}`,
            "X-com-zoho-books-organizationid": orgId,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            contact_name: `${name.trim()} (${cleanEmail})`,
            email: cleanEmail,
          }),
          cache: "no-store",
        });
        if (retryRes.ok) {
          const createData = await retryRes.json();
          const parsedCreate = zohoBooksContactCreateResponseSchema.parse(createData);
          return parsedCreate.contact.contact_id;
        }
      }
      throw new Error(`Zoho Books contact creation failed with status ${createRes.status}: ${text}`);
    }

    const createData = await createRes.json();
    const parsedCreate = zohoBooksContactCreateResponseSchema.parse(createData);
    return parsedCreate.contact.contact_id;
  }

  /**
   * Creates an estimate (quotation) for a customer.
   */
  public static async createEstimate(
    customerId: string,
    lineItems: Array<{ item_id: string; quantity: number; rate?: number }>
  ): Promise<ZohoBooksEstimate> {
    const orgId = this.getOrgId();
    const url = `https://${this.booksDomain()}/books/v3/estimates?organization_id=${orgId}`;

    const attempt = async (forceRefresh: boolean): Promise<Response> => {
      const activeToken = await ZohoService.getActiveAccessToken(forceRefresh);
      return fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${activeToken}`,
          "X-com-zoho-books-organizationid": orgId,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          line_items: lineItems,
        }),
        cache: "no-store",
      });
    };

    let res = await attempt(false);
    if (res.status === 401) {
      res = await attempt(true);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Zoho Books estimate creation failed with status ${res.status}: ${text}`);
    }

    const data = await res.json();
    const parsed = zohoBooksEstimateCreateResponseSchema.parse(data);
    return parsed.estimate;
  }

  /**
   * Emails an estimate (quotation) to a customer.
   */
  public static async sendEstimateEmail(estimateId: string, customerEmail: string): Promise<boolean> {
    const orgId = this.getOrgId();
    const url = `https://${this.booksDomain()}/books/v3/estimates/${estimateId}/email?organization_id=${orgId}`;

    const attempt = async (forceRefresh: boolean): Promise<Response> => {
      const activeToken = await ZohoService.getActiveAccessToken(forceRefresh);
      return fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${activeToken}`,
          "X-com-zoho-books-organizationid": orgId,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          to_mail_ids: [customerEmail],
        }),
        cache: "no-store",
      });
    };

    let res = await attempt(false);
    if (res.status === 401) {
      res = await attempt(true);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Zoho Books estimate email dispatch failed with status ${res.status}: ${text}`);
    }

    return true;
  }
}
