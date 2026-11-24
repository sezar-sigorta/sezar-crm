-- Supabase publishes tables in "public" through its REST API (anon key).
-- The CRM talks to Postgres directly, so enable RLS without policies: the REST API sees nothing.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inbox" ENABLE ROW LEVEL SECURITY;
