import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: UsernameRedirect,
});

function UsernameRedirect() {
  const { username } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["u", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      return data;
    },
  });
  if (isLoading) return <AppShell><p className="text-sm text-muted-foreground">Buscando @{username}…</p></AppShell>;
  if (!data) return <AppShell><p className="text-sm text-muted-foreground">Usuário @{username} não encontrado.</p></AppShell>;
  return <Navigate to="/profile/$userId" params={{ userId: data.id }} replace />;
}
