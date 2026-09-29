import { z } from "zod";

export const zohoBooksItemSchema = z.object({
  item_id: z.string(),
  name: z.string(),
  rate: z.number().optional().default(0),
  description: z.string().optional().default(""),
  status: z.string().optional().default("active"),
  sku: z.string().optional().default(""),
});

export type ZohoBooksItem = z.infer<typeof zohoBooksItemSchema>;

export const zohoBooksItemsResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  items: z.array(zohoBooksItemSchema),
});

export type ZohoBooksItemsResponse = z.infer<typeof zohoBooksItemsResponseSchema>;

export const zohoBooksContactSchema = z.object({
  contact_id: z.string(),
  contact_name: z.string(),
  company_name: z.string().optional().default(""),
  email: z.string().optional().default(""),
});

export type ZohoBooksContact = z.infer<typeof zohoBooksContactSchema>;

export const zohoBooksContactsResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  contacts: z.array(zohoBooksContactSchema),
});

export type ZohoBooksContactsResponse = z.infer<typeof zohoBooksContactsResponseSchema>;

export const zohoBooksContactCreateResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  contact: zohoBooksContactSchema,
});

export type ZohoBooksContactCreateResponse = z.infer<typeof zohoBooksContactCreateResponseSchema>;

export const zohoBooksEstimateSchema = z.object({
  estimate_id: z.string(),
  estimate_number: z.string(),
  customer_id: z.string(),
  customer_name: z.string(),
  total: z.number().optional().default(0),
});

export type ZohoBooksEstimate = z.infer<typeof zohoBooksEstimateSchema>;

export const zohoBooksEstimateCreateResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  estimate: zohoBooksEstimateSchema,
});

export type ZohoBooksEstimateCreateResponse = z.infer<typeof zohoBooksEstimateCreateResponseSchema>;
