# Custom Ops

Internal operations platform for The Gay Fan Club - managing custom fan orders and design-assisted projects.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env.local`
3. Fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### 3. Run Database Migrations

In your Supabase project dashboard:

1. Go to **SQL Editor**
2. Run each migration file in order:
   - `supabase/migrations/20260127000001_initial_schema.sql`
   - `supabase/migrations/20260127000002_seed_data.sql`
   - `supabase/migrations/20260127000003_rls_policies.sql`

### 4. Create Your First User

1. Go to **Authentication** in Supabase dashboard
2. Create a new user with email/password
3. Go to **SQL Editor** and run:

```sql
-- Get the admin role ID
SELECT id FROM roles WHERE key = 'admin';

-- Insert user record (replace USER_ID with auth user ID, ROLE_ID with admin role ID)
INSERT INTO users (id, email, full_name, role_id)
VALUES (
  'USER_ID_FROM_AUTH',
  'your-email@example.com',
  'Your Name',
  'ROLE_ID_FROM_ROLES'
);
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Next.js 14** - React framework with App Router
- **Supabase** - Database, Auth, Storage
- **Tailwind CSS** - Styling with pride color system
- **shadcn/ui** - Component primitives
- **Tanstack Query** - Server state management

## Project Structure

```
custom-ops/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Auth routes (login)
│   ├── (dashboard)/       # Protected dashboard routes
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn components
│   └── custom/            # Custom components
├── lib/
│   ├── supabase/          # Supabase clients
│   ├── hooks/             # React hooks
│   └── utils/             # Utilities
├── types/                 # TypeScript types
└── supabase/
    └── migrations/        # Database migrations
```

## Key Features

- **Email Intake Queue** - Triage incoming emails, create leads
- **Design Review Queue** - Approve/request fixes for Customify orders
- **Work Item Management** - Track custom orders and assisted projects
- **Batch Builder** - Group orders for production
- **Follow-Up Automation** - Auto-calculated follow-up dates
- **Shopify Integration** - Webhook-driven order sync
- **Microsoft 365 Integration** - Send/receive emails

## License

Proprietary - The Gay Fan Club
