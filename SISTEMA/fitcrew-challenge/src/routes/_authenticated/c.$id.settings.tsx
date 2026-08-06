import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { SectionHeader } from "@/components/app-shell";
import {
  ChallengeSettingsPanel,
  MembersBlock,
} from "@/components/challenge/challenge-settings";
import { LeaveChallengeSection } from "@/components/challenge/leave-challenge-section";
import { DeleteChallengeSection } from "@/components/challenge/delete-challenge-section";
import { getChallengeHub } from "@/lib/challenge-hub.functions";

export const Route = createFileRoute("/_authenticated/c/$id/settings")({
  component: ChallengeSettingsRoute,
});

function ChallengeSettingsRoute() {
  const { id } = Route.useParams();
  const hubFn = useServerFn(getChallengeHub);
  const { data, isLoading } = useQuery({
    queryKey: ["challenge-hub", id],
    queryFn: () => hubFn({ data: { challengeId: id } }),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const role = data?.role;
  const canEdit = role === "owner" || role === "co_admin" || role === "super_admin";
  const isOwner = role === "owner";
  const ownerId = (data?.challenge as any)?.owner_id ?? null;
  const challengeName = (data?.challenge as any)?.name ?? "este desafio";
  // Only real members (not super_admins peeking in) get the leave button.
  const isMember = role === "owner" || role === "co_admin" || role === "member";
  const isSuperAdmin = data?.is_super_admin === true;

  if (!canEdit) {
    return (
      <>
        <SectionHeader
          title="Participantes"
          subtitle="Só o dono e co-admins editam as regras. Você pode sair do desafio a qualquer momento."
        />
        <MembersBlock challengeId={id} ownerId={ownerId} canManage={false} />
        {isMember && (
          <LeaveChallengeSection
            challengeId={id}
            challengeName={challengeName}
            isOwner={false}
            isSuperAdmin={isSuperAdmin}
          />
        )}
        {isSuperAdmin && (
          <DeleteChallengeSection challengeId={id} challengeName={challengeName} />
        )}
      </>
    );
  }

  return (
    <>
      <SectionHeader
        title="Configurações do desafio"
        subtitle="Cada desafio tem suas próprias regras, exercícios e premiação."
      />
      <ChallengeSettingsPanel challengeId={id} />
      {isMember && (
        <LeaveChallengeSection
          challengeId={id}
          challengeName={challengeName}
          isOwner={isOwner}
          isSuperAdmin={isSuperAdmin}
        />
      )}
      {isSuperAdmin && (
        <DeleteChallengeSection challengeId={id} challengeName={challengeName} />
      )}
    </>
  );
}
