import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const redeemSchema = z.object({
  code: z.string().trim().min(3).max(32),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username inválido. Use 3-20: letras, números e _"),
  displayName: z.string().trim().min(2).max(60).optional(),
});

const redeemChallengeSchema = z.object({
  challengeCode: z.string().trim().min(4).max(16),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username inválido. Use 3-20: letras, números e _"),
  displayName: z.string().trim().min(2).max(60).optional(),
});

/**
 * Signup gated by a CHALLENGE invite code (not a general invite).
 * When a user opens a /join/<code> link and doesn't have an account yet,
 * the challenge invite itself is used as the practical entry gate:
 * we validate the challenge code, create the account, and let the
 * client auto-join the challenge right after.
 */
export const redeemChallengeInviteAndSignup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => redeemChallengeSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.challengeCode.toUpperCase().trim();

    // 1) Validate that the challenge invite is real + active
    const { data: chRow, error: chErr } = await supabaseAdmin
      .from("challenges")
      .select("id, is_active, invite_enabled")
      .ilike("invite_code", code)
      .maybeSingle();
    if (chErr) throw new Error(chErr.message);
    if (!chRow || !chRow.invite_enabled || !chRow.is_active) {
      return { ok: false as const, reason: "invalid_challenge" as const };
    }

    // 2) Username availability
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (taken) return { ok: false as const, reason: "username_taken" as const };

    // 3) Create user (auto-confirmed)
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName ?? data.username },
    });
    if (created.error || !created.data?.user) {
      const msg = created.error?.message ?? "Falha ao criar conta.";
      if (/already/i.test(msg)) return { ok: false as const, reason: "email_taken" as const };
      throw new Error(msg);
    }
    const userId = created.data.user.id;

    // 4) Set username on the auto-created profile row
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        username: data.username,
        display_name: data.displayName ?? data.username,
      })
      .eq("id", userId);
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      if (/username/i.test(profErr.message)) {
        return { ok: false as const, reason: "username_taken" as const };
      }
      throw new Error(profErr.message);
    }

    // 5) Auto-join the challenge as member (idempotent)
    const { error: joinErr } = await supabaseAdmin
      .from("challenge_members")
      .insert({ challenge_id: chRow.id, user_id: userId, role: "member" });
    if (joinErr && !/duplicate|unique/i.test(joinErr.message)) {
      // non-fatal: user still has an account; client can retry join
      console.error("[redeemChallengeInviteAndSignup] join failed:", joinErr.message);
    }

    return { ok: true as const, challengeId: chRow.id };
  });

/**
 * Redeem invite + create account atomically. Public endpoint gated by invite code.
 * Auto-confirms the email so the user can sign in immediately after.
 */
export const redeemInviteAndSignup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => redeemSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase().trim();

    // 1) Validate invite (still unused + not expired)
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("invites")
      .select("id, is_used, expires_at")
      .eq("code", code)
      .maybeSingle();
    if (inviteErr) throw new Error(inviteErr.message);
    if (!invite || invite.is_used) {
      return { ok: false as const, reason: "invalid" as const };
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }

    // 2) Username availability
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (taken) return { ok: false as const, reason: "username_taken" as const };

    // 3) Create user (auto-confirmed)
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.displayName ?? data.username,
      },
    });
    if (created.error || !created.data?.user) {
      const msg = created.error?.message ?? "Falha ao criar conta.";
      if (/already/i.test(msg)) return { ok: false as const, reason: "email_taken" as const };
      throw new Error(msg);
    }
    const userId = created.data.user.id;

    // 4) Set username on the auto-created profile row
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        username: data.username,
        display_name: data.displayName ?? data.username,
      })
      .eq("id", userId);
    if (profErr) {
      // rollback the user so the invite stays usable
      await supabaseAdmin.auth.admin.deleteUser(userId);
      if (/username/i.test(profErr.message)) {
        return { ok: false as const, reason: "username_taken" as const };
      }
      throw new Error(profErr.message);
    }

    // 5) Consume invite
    const { error: consumeErr } = await supabaseAdmin
      .from("invites")
      .update({ is_used: true, used_by: userId, used_at: new Date().toISOString() })
      .eq("id", invite.id)
      .eq("is_used", false);
    if (consumeErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(consumeErr.message);
    }

    return { ok: true as const };
  });

/**
 * Authenticated: generate a new invite code owned by the current user.
 */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: code, error } = await context.supabase.rpc("generate_invite_code");
    if (error || !code) throw new Error(error?.message ?? "Falha ao gerar código.");
    const { data: invite, error: insErr } = await context.supabase
      .from("invites")
      .insert({ code, created_by: context.userId })
      .select("id, code, created_at")
      .single();
    if (insErr || !invite) throw new Error(insErr?.message ?? "Falha ao criar convite.");
    return invite;
  });

/**
 * Authenticated: list my invites.
 */
export const listMyInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("invites")
      .select("id, code, is_used, used_at, created_at")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { invites: data ?? [] };
  });

// ---------------- Invite Requests ----------------

const requestInviteSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  name: z.string().trim().max(80).optional(),
  message: z.string().trim().max(500).optional(),
});

/**
 * Public: anyone (anon) can submit an invite request.
 */
export const requestInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestInviteSchema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const email = data.email.toLowerCase();

    // Prevent spam: block if same email has a pending request in last 24h.
    // Uses admin only when needed — falls back gracefully if not available.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data: existing } = await supabaseAdmin
        .from("invite_requests")
        .select("id")
        .eq("email", email)
        .eq("status", "pending")
        .gte("created_at", since)
        .maybeSingle();
      if (existing) return { ok: false as const, reason: "duplicate" as const };
    } catch {
      // service role indisponível — segue apenas com a inserção pública
    }

    const { error } = await client.from("invite_requests").insert({
      email,
      name: data.name ?? null,
      message: data.message ?? null,
      status: "pending",
    });
    if (error) {
      // Duplicidade tratada pela unique key (email + status pending) se existir
      if (/duplicate|unique/i.test(error.message)) {
        return { ok: false as const, reason: "duplicate" as const };
      }
      throw new Error(error.message);
    }
    return { ok: true as const };
  });


/** Admin-only helper */
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito ao admin.");
}

/**
 * Admin: list invite requests (default: pending only).
 */
export const listInviteRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let query = context.supabase
      .from("invite_requests")
      .select("id, email, name, message, status, invite_id, reviewed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { requests: rows ?? [] };
  });

/**
 * Admin: approve a request → generates an invite code linked to the request.
 * Returns the code so the admin can share it manually.
 */
export const approveInviteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    // Load the request so we know who to email
    const { data: reqRow, error: reqErr } = await context.supabase
      .from("invite_requests")
      .select("id, email, name, status")
      .eq("id", data.id)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!reqRow) throw new Error("Solicitação não encontrada.");
    if (reqRow.status !== "pending") throw new Error("Essa solicitação já foi processada.");

    const { data: code, error: codeErr } = await context.supabase.rpc("generate_invite_code");
    if (codeErr || !code) throw new Error(codeErr?.message ?? "Falha ao gerar código.");
    const { data: invite, error: insErr } = await context.supabase
      .from("invites")
      .insert({ code, created_by: context.userId })
      .select("id, code")
      .single();
    if (insErr || !invite) throw new Error(insErr?.message ?? "Falha ao criar convite.");
    const { error: updErr } = await context.supabase
      .from("invite_requests")
      .update({
        status: "approved",
        invite_id: invite.id,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    // Send invite email via connected Gmail. Non-fatal if it fails.
    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendInviteEmailViaGmail({
        to: reqRow.email,
        name: reqRow.name,
        code: invite.code,
      });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error("[approveInviteRequest] email send failed:", emailError);
    }

    return { ok: true as const, code: invite.code, emailSent, emailError };
  });

/**
 * Build an RFC 2822 message (UTF-8 HTML) and base64url-encode it for Gmail API.
 */
function buildRawEmail(params: {
  fromName: string;
  toEmail: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
}): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject, "utf-8").toString("base64")}?=`;
  const to = params.toName ? `${params.toName} <${params.toEmail}>` : params.toEmail;
  const boundary = `----=_Part_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  const lines = [
    `From: ${params.fromName} <me>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.text, "utf-8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.html, "utf-8").toString("base64"),
    `--${boundary}--`,
    "",
  ];

  return Buffer.from(lines.join("\r\n"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendInviteEmailViaGmail(params: {
  to: string;
  name: string | null;
  code: string;
}) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!GOOGLE_MAIL_API_KEY) throw new Error("GOOGLE_MAIL_API_KEY not configured");

  const firstName = params.name?.trim().split(/\s+/)[0] ?? null;
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";
  const subject = `Seu convite para o FitCrew chegou 🔥`;

  const text = [
    greeting,
    "",
    "Seu acesso ao FitCrew foi aprovado.",
    "",
    `Código de convite: ${params.code}`,
    "",
    "Como entrar:",
    "1. Acesse o app e vá para a tela de acesso.",
    `2. Cole o código ${params.code} no campo de convite.`,
    "3. Crie seu perfil e comece a treinar com a crew.",
    "",
    "Esse código é único e só pode ser usado uma vez. Guarde bem.",
    "",
    "Nos vemos lá dentro.",
    "— FitCrew",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#0b0b0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0f;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.35);">
            <tr>
              <td style="background:linear-gradient(135deg,#ff6a2c 0%,#ff9040 100%);padding:36px 32px;">
                <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:700;">FitCrew · Crew Challenge</div>
                <div style="margin-top:10px;font-size:26px;line-height:1.2;color:#fff;font-weight:800;">Seu acesso foi aprovado</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 12px 0;font-size:16px;color:#111;">${greeting}</p>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#444;">
                  Bem-vindo(a) à crew. Use o código abaixo pra criar sua conta e entrar direto no feed.
                </p>

                <div style="margin:0 0 24px 0;padding:20px;border:1px dashed #ff6a2c;border-radius:14px;background:#fff6f0;text-align:center;">
                  <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b64510;font-weight:700;">Seu código de convite</div>
                  <div style="margin-top:8px;font-size:30px;letter-spacing:0.14em;color:#ff6a2c;font-weight:800;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">${params.code}</div>
                </div>

                <div style="margin:0 0 24px 0;">
                  <div style="font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#666;font-weight:700;margin-bottom:10px;">Como entrar</div>
                  <ol style="margin:0;padding-left:20px;font-size:15px;line-height:1.7;color:#333;">
                    <li>Abra o app e vá pra tela de acesso.</li>
                    <li>Cole o código <strong>${params.code}</strong> no campo de convite.</li>
                    <li>Crie seu <em>@username</em>, defina sua senha e pronto.</li>
                  </ol>
                </div>

                <p style="margin:0 0 8px 0;font-size:13px;color:#888;">
                  Esse código é único e só pode ser usado uma vez. Não compartilhe com ninguém.
                </p>
                <p style="margin:24px 0 0 0;font-size:15px;color:#111;">Nos vemos lá dentro. 🔥</p>
                <p style="margin:4px 0 0 0;font-size:15px;color:#111;font-weight:700;">— FitCrew</p>
              </td>
            </tr>
          </table>
          <div style="margin-top:16px;font-size:11px;color:#666;">Você recebeu este email porque solicitou acesso ao FitCrew.</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const raw = buildRawEmail({
    fromName: "FitCrew",
    toEmail: params.to,
    toName: params.name,
    subject,
    html,
    text,
  });

  const res = await fetch(
    "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API ${res.status}: ${body}`);
  }
}

/**
 * Admin: reject a request.
 */
export const rejectInviteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("invite_requests")
      .update({
        status: "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

