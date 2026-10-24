/**
 * Per-member legal role. A direct-to-consumer account is a personal health
 * record vendor under the FTC Health Breach Notification Rule and state
 * consumer-health laws. HIPAA applies when a covered sponsor receives data
 * from the service or directs how it is operated. A sponsor who only pays
 * the invoice is not, by itself, enough to switch the account to HIPAA.
 * Counsel confirms edge cases. This is not a legal determination.
 */

export type RegulatoryRole = "phr-vendor" | "hipaa-business-associate";

export interface Sponsorship {
  /** A plan or clinic pays for the account. */
  sponsored: boolean;
  /** The sponsor receives charts, gaps, engagement, or other member data. */
  sponsorReceivesData: boolean;
  /** The sponsor directs features, outreach, or how the record is operated. */
  sponsorDirectsService: boolean;
}

export function regulatoryRoleFor(sponsorship: Sponsorship): RegulatoryRole {
  if (sponsorship.sponsored && (sponsorship.sponsorReceivesData || sponsorship.sponsorDirectsService)) {
    return "hipaa-business-associate";
  }
  return "phr-vendor";
}
