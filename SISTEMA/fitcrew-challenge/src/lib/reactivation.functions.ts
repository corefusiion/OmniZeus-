import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Info para o modal de nova temporada — quantos membros e qual o preço. */
export const getReactivationInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getReactivationInfoFor } = await import("./reactivation-checkout.server");
    return getReactivationInfoFor(context.userId, data.challengeId);
  });
