# Local demo workspace seed

Use this seed only with the local Docker Compose development stack. It creates or refreshes one clearly marked `[DEMO]` organization and membership roles for the four demo accounts registered through the UI:

| Account | Organization role |
|---|---|
| `owner.demo@giveaid.local` | `OWNER` |
| `campaign.demo@giveaid.local` | `CAMPAIGN_MANAGER` |
| `finance.demo@giveaid.local` | `FINANCE_MANAGER` |
| `staff.demo@giveaid.local` | `STAFF` |

Run from the repository root in PowerShell:

```powershell
powershell -NoProfile -File scripts/seed-demo-roles.ps1
```

The script reads the local SQL bootstrap password from `.env`, looks up the four existing accounts in `GiveAid_Identity`, and commits the organization, workspace, memberships, and role rows in one transaction in `GiveAid_Organization`. It is idempotent and uses a fixed seed organization ID. It does not create accounts, change Identity roles, create legal documents, claim consent, or represent a real legal approval. All profile and contact values are synthetic; the seed is marked in organization activity as `DEMO_SEED`.

The app's regular approval flow remains unchanged. Remove the seeded workspace through normal local database reset procedures only if you intentionally want to discard this demo data.
