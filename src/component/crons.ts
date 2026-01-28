import { cronJobs } from "convex/server";
import { api } from "./_generated/api.js";

const crons = cronJobs();

/**
 * Daily job to expire old referrals.
 * Runs at 2:00 AM UTC every day.
 */
crons.daily(
  "expire referrals",
  { hourUTC: 2, minuteUTC: 0 },
  api.referrals.expireReferrals,
);

export default crons;
