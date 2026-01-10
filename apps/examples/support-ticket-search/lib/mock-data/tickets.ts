import type { NewSupportTicket } from "@/db/schema";

export const mockTickets: NewSupportTicket[] = [
  // Billing Issues
  {
    id: "TKT-001",
    title: "Unable to process credit card payment",
    description:
      "Customer attempted to upgrade their plan from Basic to Pro but received an error: 'Payment method declined'. They have verified the card works on other sites and has sufficient funds. Issue started happening yesterday around 3 PM EST.",
    category: "billing",
    priority: "high",
    status: "open",
    customerEmail: "sarah.johnson@techcorp.com",
    tags: ["payment", "credit-card", "upgrade"],
    createdAt: new Date("2025-01-07T10:30:00Z"),
    updatedAt: new Date("2025-01-07T10:30:00Z"),
  },
  {
    id: "TKT-002",
    title: "Double charged for monthly subscription",
    description:
      "I was charged twice for my January subscription. Transaction IDs: TXN-8834 and TXN-8835, both for $49.99. Please refund one of these charges. This is the second time this has happened.",
    category: "billing",
    priority: "high",
    status: "in_progress",
    resolution: "Investigating with payment processor. Refund initiated.",
    customerEmail: "mike.chen@startup.io",
    tags: ["refund", "duplicate-charge", "subscription"],
    createdAt: new Date("2025-01-06T14:22:00Z"),
    updatedAt: new Date("2025-01-07T09:15:00Z"),
  },
  {
    id: "TKT-003",
    title: "Invoice not showing correct discount",
    description:
      "Applied annual discount code SAVE20 but my invoice still shows full price. The code was supposed to give 20% off the yearly plan. Order confirmation shows the discount was applied but the actual charge was for the full amount.",
    category: "billing",
    priority: "medium",
    status: "resolved",
    resolution:
      "Discount code was expired. Applied a courtesy 15% discount and issued partial refund of $35.88.",
    customerEmail: "jennifer.smith@designstudio.co",
    tags: ["discount", "invoice", "promo-code"],
    createdAt: new Date("2025-01-05T09:45:00Z"),
    updatedAt: new Date("2025-01-06T11:30:00Z"),
  },
  {
    id: "TKT-004",
    title: "Need to update payment method before renewal",
    description:
      "My credit card on file expires at the end of this month. I need to update to a new card but the payment settings page keeps timing out. My renewal is on January 15th and I don't want service interruption.",
    category: "billing",
    priority: "medium",
    status: "resolved",
    resolution:
      "Cleared cached session data. Customer was able to update payment method successfully.",
    customerEmail: "robert.williams@enterprise.com",
    tags: ["payment-method", "renewal", "card-update"],
    createdAt: new Date("2025-01-04T16:00:00Z"),
    updatedAt: new Date("2025-01-05T08:20:00Z"),
  },
  {
    id: "TKT-005",
    title: "Request for itemized billing statement",
    description:
      "Our accounting department requires an itemized billing statement for Q4 2024 for tax purposes. Need breakdown by service type, dates, and any applicable taxes. Please send in PDF format.",
    category: "billing",
    priority: "low",
    status: "closed",
    resolution:
      "Generated and emailed itemized statement covering Oct-Dec 2024 with all requested details.",
    customerEmail: "accounting@bigcorp.net",
    tags: ["statement", "tax", "accounting"],
    createdAt: new Date("2025-01-03T11:15:00Z"),
    updatedAt: new Date("2025-01-04T14:45:00Z"),
  },

  // Technical Issues
  {
    id: "TKT-006",
    title: "API returning 500 errors intermittently",
    description:
      "Our integration with your API has been failing about 30% of the time since yesterday. Getting HTTP 500 Internal Server Error responses. Affected endpoints: /api/v2/users and /api/v2/projects. Request IDs attached in the logs below.",
    category: "technical",
    priority: "critical",
    status: "in_progress",
    customerEmail: "devops@techstartup.com",
    tags: ["api", "500-error", "integration"],
    createdAt: new Date("2025-01-08T02:30:00Z"),
    updatedAt: new Date("2025-01-08T03:45:00Z"),
  },
  {
    id: "TKT-007",
    title: "Dashboard not loading - blank white screen",
    description:
      "When I log in, I just see a blank white screen instead of the dashboard. Tried clearing cache, different browsers (Chrome, Firefox, Safari), and incognito mode. Console shows 'ChunkLoadError: Loading chunk 7 failed'. Started happening after your update last night.",
    category: "technical",
    priority: "high",
    status: "resolved",
    resolution:
      "Deployment issue caused cached JavaScript chunks to become stale. Deployed fix and instructed customer to hard refresh (Ctrl+Shift+R).",
    customerEmail: "emily.davis@marketing.co",
    tags: ["dashboard", "loading", "javascript"],
    createdAt: new Date("2025-01-07T08:00:00Z"),
    updatedAt: new Date("2025-01-07T10:30:00Z"),
  },
  {
    id: "TKT-008",
    title: "File upload failing for large files",
    description:
      "Cannot upload files larger than 10MB even though our plan allows up to 100MB. Getting error 'Request Entity Too Large' when trying to upload a 25MB PDF. Smaller files work fine. Using Chrome on Windows 11.",
    category: "technical",
    priority: "medium",
    status: "open",
    customerEmail: "david.wilson@lawfirm.com",
    tags: ["upload", "file-size", "pdf"],
    createdAt: new Date("2025-01-07T14:20:00Z"),
    updatedAt: new Date("2025-01-07T14:20:00Z"),
  },
  {
    id: "TKT-009",
    title: "Webhook notifications not being delivered",
    description:
      "Set up webhook endpoint at https://our-server.com/webhooks/yourapp but not receiving any notifications. Verified our server is reachable and returns 200 OK. Webhook was working until about 3 days ago. No changes on our end.",
    category: "technical",
    priority: "high",
    status: "in_progress",
    resolution:
      "Found webhook URL was marked as failing due to previous timeout. Reset failure counter.",
    customerEmail: "backend@saascompany.io",
    tags: ["webhook", "notifications", "integration"],
    createdAt: new Date("2025-01-06T11:45:00Z"),
    updatedAt: new Date("2025-01-07T16:00:00Z"),
  },
  {
    id: "TKT-010",
    title: "Search results are very slow",
    description:
      "Search queries that used to return in under 1 second now take 15-20 seconds. We have about 50,000 documents indexed. This is severely impacting our team's productivity. Started noticing this about a week ago.",
    category: "technical",
    priority: "high",
    status: "resolved",
    resolution:
      "Customer's workspace was missing search index. Triggered reindex which completed in 4 hours. Search now returns in <500ms.",
    customerEmail: "cto@researchlab.edu",
    tags: ["search", "performance", "slow"],
    createdAt: new Date("2025-01-05T13:30:00Z"),
    updatedAt: new Date("2025-01-06T18:00:00Z"),
  },
  {
    id: "TKT-011",
    title: "Mobile app crashing on iOS 17",
    description:
      "App crashes immediately after opening on my iPhone 15 Pro running iOS 17.2.1. Was working fine until the latest app update (v3.4.2). Already tried reinstalling. Other team members with iOS 16 are not affected.",
    category: "technical",
    priority: "high",
    status: "open",
    customerEmail: "alex.martinez@consulting.com",
    tags: ["mobile", "ios", "crash"],
    createdAt: new Date("2025-01-08T09:00:00Z"),
    updatedAt: new Date("2025-01-08T09:00:00Z"),
  },
  {
    id: "TKT-012",
    title: "Export to CSV producing corrupted files",
    description:
      "When exporting reports to CSV, the file opens with garbled characters in Excel. Looks like encoding issue - seeing Ã© instead of é for example. Export to PDF works fine. This affects all reports, not just one specific one.",
    category: "technical",
    priority: "medium",
    status: "resolved",
    resolution:
      "Added UTF-8 BOM to CSV exports for better Excel compatibility. Customer confirmed fix works.",
    customerEmail: "analyst@datacompany.com",
    tags: ["export", "csv", "encoding"],
    createdAt: new Date("2025-01-04T10:00:00Z"),
    updatedAt: new Date("2025-01-05T15:30:00Z"),
  },
  {
    id: "TKT-013",
    title: "Two-factor authentication not sending codes",
    description:
      "Not receiving 2FA codes via SMS to my phone number ending in 4521. Tried resend multiple times. My carrier is Verizon. Need to access my account urgently for a client presentation in 2 hours.",
    category: "technical",
    priority: "critical",
    status: "resolved",
    resolution:
      "SMS provider had delivery issues with Verizon. Temporarily switched customer to email-based 2FA. Permanent fix deployed for SMS routing.",
    customerEmail: "urgent@clientservices.com",
    tags: ["2fa", "sms", "authentication"],
    createdAt: new Date("2025-01-07T13:00:00Z"),
    updatedAt: new Date("2025-01-07T13:45:00Z"),
  },

  // Account Issues
  {
    id: "TKT-014",
    title: "Cannot reset password - link expired",
    description:
      "Every time I request a password reset, by the time I check my email and click the link, it says the link has expired. I'm clicking within 5 minutes of receiving the email. Please help, I've been locked out for 2 days.",
    category: "account",
    priority: "high",
    status: "resolved",
    resolution:
      "Customer's email server was delaying delivery by 30+ minutes. Extended reset link validity to 2 hours and sent fresh link.",
    customerEmail: "locked.out.user@slowemail.org",
    tags: ["password", "reset", "email"],
    createdAt: new Date("2025-01-06T09:30:00Z"),
    updatedAt: new Date("2025-01-06T11:00:00Z"),
  },
  {
    id: "TKT-015",
    title: "Need to transfer account ownership",
    description:
      "I'm leaving the company and need to transfer ownership of our team account to my colleague John Doe (john.doe@ourcompany.com). He should become the new admin with full access to billing and team management.",
    category: "account",
    priority: "medium",
    status: "in_progress",
    customerEmail: "departing.employee@ourcompany.com",
    tags: ["ownership", "transfer", "admin"],
    createdAt: new Date("2025-01-07T15:00:00Z"),
    updatedAt: new Date("2025-01-08T08:00:00Z"),
  },
  {
    id: "TKT-016",
    title: "Account shows wrong timezone",
    description:
      "All timestamps in my account are showing in PST but I'm in EST timezone. Changed the timezone setting to Eastern Time but it's not applying. Affects all reports and activity logs which is confusing for our team.",
    category: "account",
    priority: "low",
    status: "resolved",
    resolution:
      "Timezone change requires logout/login to take effect. Customer re-logged and confirmed fix.",
    customerEmail: "eastcoast@business.com",
    tags: ["timezone", "settings", "display"],
    createdAt: new Date("2025-01-05T12:00:00Z"),
    updatedAt: new Date("2025-01-05T14:30:00Z"),
  },
  {
    id: "TKT-017",
    title: "Request to delete all my data - GDPR",
    description:
      "Under GDPR Article 17, I request complete deletion of all my personal data from your systems. This includes my account, all uploaded files, usage history, and any backups. Please confirm deletion within 30 days as required.",
    category: "account",
    priority: "medium",
    status: "in_progress",
    customerEmail: "privacy.request@eucompany.de",
    tags: ["gdpr", "data-deletion", "privacy"],
    createdAt: new Date("2025-01-06T16:00:00Z"),
    updatedAt: new Date("2025-01-07T10:00:00Z"),
  },
  {
    id: "TKT-018",
    title: "Merge duplicate accounts",
    description:
      "I accidentally created two accounts - one with my work email and one with my personal email. Would like to merge them into my work email account and keep all the data from both. Work: me@work.com, Personal: me@gmail.com",
    category: "account",
    priority: "low",
    status: "closed",
    resolution:
      "Merged accounts successfully. All projects, files, and history now under work email. Deleted personal account after confirmation.",
    customerEmail: "me@work.com",
    tags: ["merge", "duplicate", "accounts"],
    createdAt: new Date("2025-01-03T08:00:00Z"),
    updatedAt: new Date("2025-01-04T17:00:00Z"),
  },
  {
    id: "TKT-019",
    title: "Suspicious login attempt notification",
    description:
      "Received email about login attempt from Russia but I'm in California and haven't traveled. Want to ensure my account is secure. Please check if there was actual unauthorized access and what data might have been viewed.",
    category: "account",
    priority: "critical",
    status: "resolved",
    resolution:
      "Confirmed login attempt was blocked by our security system. No unauthorized access occurred. Enabled additional security measures and recommended password change.",
    customerEmail: "security.conscious@company.com",
    tags: ["security", "unauthorized", "login"],
    createdAt: new Date("2025-01-07T22:00:00Z"),
    updatedAt: new Date("2025-01-08T01:30:00Z"),
  },

  // Feature Requests
  {
    id: "TKT-020",
    title: "Request: Dark mode for web application",
    description:
      "Would love to see a dark mode option for the web app. I work late nights and the bright white interface is straining my eyes. Even a basic dark theme would be greatly appreciated. This is a common request I've seen in your community forums.",
    category: "feature",
    priority: "low",
    status: "open",
    customerEmail: "night.owl@developer.io",
    tags: ["dark-mode", "ui", "accessibility"],
    createdAt: new Date("2025-01-05T23:00:00Z"),
    updatedAt: new Date("2025-01-05T23:00:00Z"),
  },
  {
    id: "TKT-021",
    title: "Feature request: Bulk import from Google Sheets",
    description:
      "We manage our data in Google Sheets and manually copying it over is time-consuming. A direct import feature from Google Sheets would save us hours each week. Ideally with automatic sync option to keep data updated.",
    category: "feature",
    priority: "medium",
    status: "open",
    customerEmail: "productivity@team.co",
    tags: ["import", "google-sheets", "integration"],
    createdAt: new Date("2025-01-06T10:30:00Z"),
    updatedAt: new Date("2025-01-06T10:30:00Z"),
  },
  {
    id: "TKT-022",
    title: "Add Slack integration for notifications",
    description:
      "Our team lives in Slack. Would be great to get notifications directly in our Slack channels instead of email. Specifically interested in: new comments, task assignments, and deadline reminders. Zapier workaround is clunky.",
    category: "feature",
    priority: "medium",
    status: "in_progress",
    resolution:
      "Added to Q1 roadmap. Beta available next month - customer added to beta list.",
    customerEmail: "slack.lover@modernteam.com",
    tags: ["slack", "notifications", "integration"],
    createdAt: new Date("2025-01-04T14:00:00Z"),
    updatedAt: new Date("2025-01-07T09:00:00Z"),
  },
  {
    id: "TKT-023",
    title: "Custom branding options for client portal",
    description:
      "We share project portals with our clients but they show your branding. Need ability to add our logo, colors, and custom domain (projects.ourcompany.com). White-labeling is essential for our enterprise clients.",
    category: "feature",
    priority: "high",
    status: "open",
    customerEmail: "enterprise@agency.com",
    tags: ["white-label", "branding", "enterprise"],
    createdAt: new Date("2025-01-07T11:00:00Z"),
    updatedAt: new Date("2025-01-07T11:00:00Z"),
  },
  {
    id: "TKT-024",
    title: "Request for API rate limit increase",
    description:
      "Current rate limit of 100 requests/minute is limiting our automation workflows. We're building a heavy integration that needs at least 500 req/min. Happy to discuss enterprise pricing if needed for higher limits.",
    category: "feature",
    priority: "medium",
    status: "resolved",
    resolution:
      "Increased rate limit to 300 req/min on current plan. Enterprise plan with 1000 req/min discussed - customer considering upgrade.",
    customerEmail: "integration@automation.io",
    tags: ["api", "rate-limit", "enterprise"],
    createdAt: new Date("2025-01-05T16:30:00Z"),
    updatedAt: new Date("2025-01-06T13:00:00Z"),
  },
  {
    id: "TKT-025",
    title: "Keyboard shortcuts for power users",
    description:
      "Please add keyboard shortcuts for common actions. I'd use these daily: Cmd+N for new item, Cmd+S for save, Cmd+/ for search, Cmd+Shift+D for duplicate. Similar to how Notion or Linear handle shortcuts.",
    category: "feature",
    priority: "low",
    status: "closed",
    resolution:
      "Keyboard shortcuts shipped in v3.5.0 release. Documentation available at docs.example.com/shortcuts",
    customerEmail: "keyboard.ninja@productivity.co",
    tags: ["shortcuts", "ux", "productivity"],
    createdAt: new Date("2024-12-20T09:00:00Z"),
    updatedAt: new Date("2025-01-02T12:00:00Z"),
  },

  // General Inquiries
  {
    id: "TKT-026",
    title: "Question about data retention policy",
    description:
      "How long do you retain deleted data? We're undergoing a compliance audit and need to document all our vendors' data retention policies. Also need to know where data is stored geographically.",
    category: "general",
    priority: "medium",
    status: "resolved",
    resolution:
      "Provided official data retention policy document. Deleted data retained for 30 days in soft-delete, then permanently purged. Data stored in US-East and EU-West regions based on account setting.",
    customerEmail: "compliance@regulated.com",
    tags: ["compliance", "data-retention", "security"],
    createdAt: new Date("2025-01-05T11:00:00Z"),
    updatedAt: new Date("2025-01-06T09:30:00Z"),
  },
  {
    id: "TKT-027",
    title: "Do you offer educational discounts?",
    description:
      "I'm a professor at State University looking to use your platform for my computer science course. Do you offer any academic or educational discounts? We'd have approximately 150 students per semester.",
    category: "general",
    priority: "low",
    status: "resolved",
    resolution:
      "Yes! 50% discount for verified educational institutions. Sent application form and verification process details.",
    customerEmail: "professor@stateuniversity.edu",
    tags: ["education", "discount", "pricing"],
    createdAt: new Date("2025-01-04T13:00:00Z"),
    updatedAt: new Date("2025-01-04T16:30:00Z"),
  },
  {
    id: "TKT-028",
    title: "SOC 2 compliance documentation request",
    description:
      "Our security team needs your SOC 2 Type II report and any other compliance certifications before we can proceed with procurement. Also need your security questionnaire filled out if possible.",
    category: "general",
    priority: "medium",
    status: "in_progress",
    customerEmail: "security.review@bigbank.com",
    tags: ["soc2", "compliance", "security"],
    createdAt: new Date("2025-01-07T10:00:00Z"),
    updatedAt: new Date("2025-01-08T08:30:00Z"),
  },
  {
    id: "TKT-029",
    title: "Difference between Pro and Enterprise plans",
    description:
      "Trying to decide between Pro and Enterprise plans for our 50-person team. Main questions: What's included in priority support? Is SSO only on Enterprise? Can we get a trial of Enterprise features?",
    category: "general",
    priority: "low",
    status: "closed",
    resolution:
      "Sent detailed comparison document. SSO and advanced audit logs are Enterprise-only. Offered 14-day Enterprise trial which customer accepted.",
    customerEmail: "purchasing@midsize.com",
    tags: ["pricing", "plans", "sales"],
    createdAt: new Date("2025-01-03T15:00:00Z"),
    updatedAt: new Date("2025-01-04T10:00:00Z"),
  },
  {
    id: "TKT-030",
    title: "How to contact sales for annual contract",
    description:
      "We want to switch from monthly to annual billing for our team of 25. Looking for the best discount available and want to discuss multi-year options. Who should I talk to?",
    category: "general",
    priority: "low",
    status: "resolved",
    resolution:
      "Connected with sales team. Offered 20% annual discount + additional 10% for 2-year commitment. Customer signed 2-year agreement.",
    customerEmail: "finance@growingcompany.com",
    tags: ["sales", "annual", "contract"],
    createdAt: new Date("2025-01-02T14:00:00Z"),
    updatedAt: new Date("2025-01-05T11:30:00Z"),
  },

  // More Technical Issues
  {
    id: "TKT-031",
    title: "SSO login failing with SAML error",
    description:
      "Getting 'SAML Response signature verification failed' when employees try to login via Okta SSO. Was working until we rotated our Okta certificates yesterday. Already updated the certificate in your SSO settings.",
    category: "technical",
    priority: "critical",
    status: "in_progress",
    customerEmail: "it.admin@enterprise.com",
    tags: ["sso", "saml", "okta"],
    createdAt: new Date("2025-01-08T07:00:00Z"),
    updatedAt: new Date("2025-01-08T08:15:00Z"),
  },
  {
    id: "TKT-032",
    title: "Real-time collaboration not syncing",
    description:
      "When multiple team members edit the same document, changes aren't appearing in real-time. Have to manually refresh to see others' edits. We rely heavily on collaborative editing feature. Network seems fine for other apps.",
    category: "technical",
    priority: "high",
    status: "open",
    customerEmail: "collaborative@remoteteam.io",
    tags: ["collaboration", "sync", "realtime"],
    createdAt: new Date("2025-01-07T16:45:00Z"),
    updatedAt: new Date("2025-01-07T16:45:00Z"),
  },
  {
    id: "TKT-033",
    title: "Scheduled reports not being generated",
    description:
      "Set up weekly reports to be generated every Monday at 9 AM but haven't received any for the past 3 weeks. The schedule shows as active in settings. Need these reports for our weekly team meetings.",
    category: "technical",
    priority: "medium",
    status: "resolved",
    resolution:
      "Report scheduler job was stuck. Restarted scheduler service and regenerated missing reports. Added monitoring to prevent future issues.",
    customerEmail: "manager@weeklyreports.com",
    tags: ["reports", "scheduler", "automation"],
    createdAt: new Date("2025-01-06T08:30:00Z"),
    updatedAt: new Date("2025-01-07T11:00:00Z"),
  },
  {
    id: "TKT-034",
    title: "Embed widget not displaying correctly",
    description:
      "Added your embed widget to our website but it's showing at wrong dimensions on mobile. Desktop looks fine but on phones it overflows the container and gets cut off. Using the standard embed code from documentation.",
    category: "technical",
    priority: "low",
    status: "open",
    customerEmail: "webdev@marketing-site.com",
    tags: ["embed", "mobile", "responsive"],
    createdAt: new Date("2025-01-07T14:00:00Z"),
    updatedAt: new Date("2025-01-07T14:00:00Z"),
  },
  {
    id: "TKT-035",
    title: "GraphQL mutation returning null",
    description:
      "The createProject mutation is returning null even though the project actually gets created in the database. Response: { data: { createProject: null } }. No errors in the response. Using Apollo Client 3.x.",
    category: "technical",
    priority: "medium",
    status: "resolved",
    resolution:
      "Bug in our GraphQL resolver not returning the created object. Fix deployed in v3.4.5. Customer confirmed working.",
    customerEmail: "graphql.dev@apifirst.io",
    tags: ["graphql", "api", "bug"],
    createdAt: new Date("2025-01-04T17:00:00Z"),
    updatedAt: new Date("2025-01-06T10:30:00Z"),
  },

  // More Account Issues
  {
    id: "TKT-036",
    title: "Team member can't accept invitation",
    description:
      "Sent invitation to new team member 3 days ago but they say they never received it. Checked spam folder. Resent twice. Their email is definitely correct: newhire@ourcompany.com. We need them onboarded ASAP.",
    category: "account",
    priority: "high",
    status: "resolved",
    resolution:
      "Email was being blocked by recipient's corporate firewall. Added our sending domain to their allowlist. Invitation received and accepted.",
    customerEmail: "hr.manager@ourcompany.com",
    tags: ["invitation", "email", "onboarding"],
    createdAt: new Date("2025-01-07T09:00:00Z"),
    updatedAt: new Date("2025-01-07T14:30:00Z"),
  },
  {
    id: "TKT-037",
    title: "Accidentally removed myself as admin",
    description:
      "While cleaning up team permissions I accidentally removed my own admin access. Now I can't manage the team or billing. I'm the account owner. Other team members are regular users only. Please help!",
    category: "account",
    priority: "critical",
    status: "resolved",
    resolution:
      "Verified identity via phone call and billing information. Restored admin privileges to account owner.",
    customerEmail: "oops.admin@mycompany.com",
    tags: ["admin", "permissions", "access"],
    createdAt: new Date("2025-01-08T04:00:00Z"),
    updatedAt: new Date("2025-01-08T05:30:00Z"),
  },
  {
    id: "TKT-038",
    title: "Update company name on account",
    description:
      "Our company recently rebranded from 'OldCorp Inc' to 'NewBrand Technologies'. Need the company name updated on our account, invoices, and any customer-facing elements. Legal name change documentation attached.",
    category: "account",
    priority: "low",
    status: "closed",
    resolution:
      "Updated company name across all systems. New invoices will reflect updated name. Historical invoices preserved for records.",
    customerEmail: "legal@newbrand.tech",
    tags: ["rebrand", "company-name", "admin"],
    createdAt: new Date("2025-01-02T10:00:00Z"),
    updatedAt: new Date("2025-01-03T16:00:00Z"),
  },

  // More Billing Issues
  {
    id: "TKT-039",
    title: "Currency conversion causing overcharge",
    description:
      "Being charged in USD but my bank converts to EUR. Your pricing page shows €45/month but I'm being charged $49 which converts to about €47. That's €24/year extra. Can you bill in EUR directly?",
    category: "billing",
    priority: "low",
    status: "resolved",
    resolution:
      "Switched account to EUR billing. Will take effect from next billing cycle. Credited €6 for previous overages.",
    customerEmail: "european.customer@eucompany.fr",
    tags: ["currency", "conversion", "international"],
    createdAt: new Date("2025-01-05T14:00:00Z"),
    updatedAt: new Date("2025-01-06T09:00:00Z"),
  },
  {
    id: "TKT-040",
    title: "Downgrade not reflected in billing",
    description:
      "Downgraded from Team plan to Pro plan on January 1st but was still charged Team plan rate ($199 instead of $49) on January 5th. Confirmation email says downgrade was processed. Please adjust.",
    category: "billing",
    priority: "high",
    status: "in_progress",
    customerEmail: "billing.issue@downgraded.com",
    tags: ["downgrade", "overcharge", "refund"],
    createdAt: new Date("2025-01-06T11:00:00Z"),
    updatedAt: new Date("2025-01-07T08:00:00Z"),
  },

  // More Feature Requests
  {
    id: "TKT-041",
    title: "Request: Calendar view for tasks",
    description:
      "Would love to see tasks in a calendar view in addition to the current list and board views. Something like Google Calendar where I can see deadlines and schedule visually. Essential for our project planning.",
    category: "feature",
    priority: "medium",
    status: "open",
    customerEmail: "pm@projectteam.co",
    tags: ["calendar", "view", "tasks"],
    createdAt: new Date("2025-01-06T13:30:00Z"),
    updatedAt: new Date("2025-01-06T13:30:00Z"),
  },
  {
    id: "TKT-042",
    title: "Add support for Markdown in comments",
    description:
      "Comments only support plain text currently. Would be great to have Markdown support for formatting - bold, italic, code blocks, and especially links. Makes technical discussions much clearer.",
    category: "feature",
    priority: "low",
    status: "closed",
    resolution:
      "Markdown support for comments shipped in v3.5.2. Includes live preview feature.",
    customerEmail: "developer@techteam.dev",
    tags: ["markdown", "comments", "formatting"],
    createdAt: new Date("2024-12-15T10:00:00Z"),
    updatedAt: new Date("2025-01-03T14:00:00Z"),
  },
  {
    id: "TKT-043",
    title: "Mobile app offline mode",
    description:
      "When traveling I often lose connectivity but need to access my data. Please add offline mode to the mobile app so I can at least view (and ideally edit) my items without internet. Sync when back online.",
    category: "feature",
    priority: "medium",
    status: "open",
    customerEmail: "frequent.traveler@remote.work",
    tags: ["mobile", "offline", "sync"],
    createdAt: new Date("2025-01-07T18:00:00Z"),
    updatedAt: new Date("2025-01-07T18:00:00Z"),
  },

  // More General Inquiries
  {
    id: "TKT-044",
    title: "Partnership inquiry",
    description:
      "We're a consulting firm specializing in digital transformation. Interested in becoming a partner/reseller of your platform. We have 200+ enterprise clients who could benefit. Who handles partnership discussions?",
    category: "general",
    priority: "medium",
    status: "in_progress",
    customerEmail: "partnerships@consultingfirm.com",
    tags: ["partnership", "reseller", "business"],
    createdAt: new Date("2025-01-07T12:00:00Z"),
    updatedAt: new Date("2025-01-08T09:00:00Z"),
  },
  {
    id: "TKT-045",
    title: "Need case study for internal approval",
    description:
      "Getting pushback from leadership on adopting your tool. Do you have any case studies from companies in the healthcare industry? Specifically interested in compliance and security aspects. Need for presentation next week.",
    category: "general",
    priority: "medium",
    status: "resolved",
    resolution:
      "Sent 3 healthcare industry case studies highlighting HIPAA compliance, security features, and ROI metrics. Offered call with existing healthcare customer for reference.",
    customerEmail: "advocate@healthcare-provider.org",
    tags: ["case-study", "healthcare", "compliance"],
    createdAt: new Date("2025-01-06T15:00:00Z"),
    updatedAt: new Date("2025-01-07T10:30:00Z"),
  },

  // Edge Cases and Interesting Issues
  {
    id: "TKT-046",
    title: "Emoji in project names breaking search",
    description:
      "When I include emojis in project names (like '🚀 Launch Project'), the search doesn't find them. Searching for 'Launch' doesn't return the project. Works fine for projects without emojis. Is this expected?",
    category: "technical",
    priority: "low",
    status: "open",
    customerEmail: "emoji.lover@creative.agency",
    tags: ["emoji", "search", "bug"],
    createdAt: new Date("2025-01-07T17:30:00Z"),
    updatedAt: new Date("2025-01-07T17:30:00Z"),
  },
  {
    id: "TKT-047",
    title: "Very large file causing browser tab crash",
    description:
      "Trying to open a 500MB JSON file in the viewer and browser tab crashes. Chrome shows 'Aw, Snap!' error. Understand it's a large file but wondering if there's a way to handle it better - maybe pagination or streaming?",
    category: "technical",
    priority: "low",
    status: "resolved",
    resolution:
      "Added file size warning for files >100MB. Implemented streaming view for large JSON files that shows first 10,000 lines with option to load more.",
    customerEmail: "data.scientist@bigdata.co",
    tags: ["large-file", "browser", "performance"],
    createdAt: new Date("2025-01-04T11:30:00Z"),
    updatedAt: new Date("2025-01-06T16:00:00Z"),
  },
  {
    id: "TKT-048",
    title: "Time zone change broke all scheduled items",
    description:
      "Changed workspace timezone from UTC to America/New_York and now all my scheduled tasks and reminders are showing 5 hours off. Affects both existing and new items. Didn't expect retroactive change to old items.",
    category: "technical",
    priority: "high",
    status: "in_progress",
    customerEmail: "confused@timezone.hell",
    tags: ["timezone", "schedule", "bug"],
    createdAt: new Date("2025-01-07T20:00:00Z"),
    updatedAt: new Date("2025-01-08T06:00:00Z"),
  },
  {
    id: "TKT-049",
    title: "Account locked after too many login attempts",
    description:
      "My account got locked after password attempts. I was trying different passwords because I couldn't remember which one I used. Now it says 'Account temporarily locked. Try again in 24 hours.' but I need access now.",
    category: "account",
    priority: "high",
    status: "resolved",
    resolution:
      "Verified identity and unlocked account. Reset password via secure link. Recommended password manager to customer.",
    customerEmail: "locked@forgetful.user",
    tags: ["locked", "security", "password"],
    createdAt: new Date("2025-01-08T06:30:00Z"),
    updatedAt: new Date("2025-01-08T07:00:00Z"),
  },
  {
    id: "TKT-050",
    title: "Import failing silently on special characters",
    description:
      "CSV import shows success but rows with special characters (ñ, ü, ø) in names are not imported. No error message. Found by comparing row counts - imported 847 of 900 rows. Need all data including international names.",
    category: "technical",
    priority: "medium",
    status: "resolved",
    resolution:
      "Import parser wasn't handling UTF-8 properly. Fixed encoding detection. Customer re-imported successfully with all 900 rows.",
    customerEmail: "international@global.team",
    tags: ["import", "csv", "encoding", "unicode"],
    createdAt: new Date("2025-01-05T08:00:00Z"),
    updatedAt: new Date("2025-01-06T14:00:00Z"),
  },
  {
    id: "TKT-051",
    title: "Audit log showing wrong IP addresses",
    description:
      "Security audit revealed that all actions in the audit log show the same IP address (10.0.0.1) regardless of where team members are connecting from. This appears to be an internal IP. Need real client IPs for compliance.",
    category: "technical",
    priority: "high",
    status: "in_progress",
    customerEmail: "security@financial.corp",
    tags: ["audit", "security", "ip-address"],
    createdAt: new Date("2025-01-07T14:30:00Z"),
    updatedAt: new Date("2025-01-08T09:00:00Z"),
  },
  {
    id: "TKT-052",
    title: "Video calls dropping after 45 minutes",
    description:
      "Integrated video calls consistently disconnect after exactly 45 minutes. Happens every time without fail. Other video tools like Zoom work fine for hours. Is there a session limit we're hitting?",
    category: "technical",
    priority: "medium",
    status: "resolved",
    resolution:
      "Yes, free tier has 45-minute limit per call. This is documented but not prominently displayed. Customer upgraded to Pro which has unlimited call duration.",
    customerEmail: "meetings@longcalls.com",
    tags: ["video", "calls", "timeout", "limit"],
    createdAt: new Date("2025-01-05T15:00:00Z"),
    updatedAt: new Date("2025-01-06T11:00:00Z"),
  },
  {
    id: "TKT-053",
    title: "Workflow automation running twice",
    description:
      "My automation that sends Slack notifications on new tasks is triggering twice for each task. Getting duplicate notifications. Only one automation configured. Started happening after your maintenance window last night.",
    category: "technical",
    priority: "medium",
    status: "resolved",
    resolution:
      "Maintenance migration caused some automations to be duplicated in database. Removed duplicate entry. Customer confirmed single notifications now.",
    customerEmail: "automation@workflow.io",
    tags: ["automation", "duplicate", "slack"],
    createdAt: new Date("2025-01-06T07:00:00Z"),
    updatedAt: new Date("2025-01-06T15:30:00Z"),
  },
];

export function getTicketById(id: string): NewSupportTicket | undefined {
  return mockTickets.find((ticket) => ticket.id === id);
}

export function getTicketsByCategory(
  category: NewSupportTicket["category"]
): NewSupportTicket[] {
  return mockTickets.filter((ticket) => ticket.category === category);
}

export function getTicketsByStatus(
  status: NewSupportTicket["status"]
): NewSupportTicket[] {
  return mockTickets.filter((ticket) => ticket.status === status);
}
