# Demo mode

The owner explicitly selected a public-demo-first launch during implementation. The release does not open customer signup or connect live company accounts.

Seven authored fictional messages cover quote, product, support, complaint, follow-up, sales and general intents. Fictional people and businesses use reserved example email domains. Four synthetic references describe the fictional catalog, support policy, shipping and team. USD prices are illustrative and are never sent to Books or a payment system.

Each tab owns its results, read flags, editable drafts, approval statuses, task assignments, rules, activity and preferences. Versioned, Zod-validated session storage rejects corrupted/oversized/expired records. Expiry is 12 hours on restoration; reset also clears state and aborts in-flight inference. Session storage can survive a browser's restore-tabs feature. No visitor state is stored in the quota store.

Live AI calls Gemini using the server key and configured model. Sample mode is deterministic and explicitly labeled. Failure or quota exhaustion does not silently return a sample labeled as live: the user receives an explanation and may choose sample mode. Resetting local state does not reset durable daily quotas.

All draft approvals are local simulations. Rules can create one task per conversation, request review or flag a review in activity. Disabling rules never disables the fixed human-review requirement. No tools, email adapter, real OAuth callback, transaction API, SMTP or financial-write code exists in the deployment.

References are supplied directly as fixed model context. This is not a claim of live Qdrant/RAG operation. Document uploads, account invitations, real customer organizations and signup are unavailable and accurately disclosed.
