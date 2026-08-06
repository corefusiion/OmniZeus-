import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });

    const [rolesRes, ownedRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.user.id),
      supabase.from("challenges").select("id", { count: "exact", head: true }).eq("owner_id", user.user.id),
    ]);

    const roles = (rolesRes.data ?? []).map((r) => r.role as string);
    const isSuperAdmin = roles.includes("super_admin");
    const ownsChallenges = (ownedRes.count ?? 0) > 0;

    if (!isSuperAdmin && !ownsChallenges) throw redirect({ to: "/feed" });
    return { isSuperAdmin };
  },
  component: () => <Outlet />,
});