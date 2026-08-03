export const SITE_NAME = "Garage";

export const APP_ROLES = ["user", "staff", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const LISTING_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "paused",
  "rejected",
  "archived",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
