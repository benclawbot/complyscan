# ComplyScan — GDPR Compliance Checker

Automated GDPR compliance scanning: enter a URL and receive a full report with findings and fix suggestions.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Payments:** Stripe (UI only in this repo)
- **Email:** Mailjet

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd compliance-checker

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start.

## Environment Variables

See `.env.local.example` for all required variables.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run test:coverage` | Run tests with coverage |

## Project Structure

```
app/
  components/    # UI components (Navbar, Hero, Pricing, etc.)
  lib/           # Utilities (cn helper)
  layout.tsx     # Root layout with fonts + metadata
  page.tsx       # Landing page
  globals.css    # Global styles + Tailwind
```

## Notes

- The `/api/scan` route is a UI placeholder. Backend logic is implemented in TASK-002.
- Stripe Checkout buttons are UI placeholders. Full Stripe integration is in TASK-003.
- Email functionality is UI placeholder only. Email delivery is in TASK-003.


