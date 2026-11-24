import { requireUser } from "@/lib/auth";
import { countNewLeads } from "@/lib/queries";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const newCount = await countNewLeads();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <Sidebar userName={user.name} newCount={newCount} />
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
