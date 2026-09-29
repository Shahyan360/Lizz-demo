-- Migration: backfill_opportunity_follow_up_date
-- No schema change. Properties created before the automated follow-up email
-- feature existed have opportunities.nextFollowUpDate = NULL. Backfill those
-- to 3 months after the property's own createdAt (not the opportunity's —
-- the opportunities table was recreated on 2026-08-09 so its createdAt is
-- not reliable for this) so the follow-up cron picks them up too.

UPDATE `opportunities` o
JOIN `properties` p ON p.`id` = o.`propertyId`
SET o.`nextFollowUpDate` = DATE_ADD(p.`createdAt`, INTERVAL 3 MONTH)
WHERE o.`nextFollowUpDate` IS NULL;
