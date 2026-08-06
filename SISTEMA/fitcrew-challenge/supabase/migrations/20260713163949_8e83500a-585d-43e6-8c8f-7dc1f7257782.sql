
-- 1) Colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_balance numeric(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_admin ON public.profiles(referred_by_admin_id);

-- 2) affiliate_earnings_log
CREATE TABLE IF NOT EXISTS public.affiliate_earnings_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  stripe_session_id text,
  gross_amount numeric(12,2) NOT NULL,
  commission_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_admin ON public.affiliate_earnings_log(admin_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_earnings_session
  ON public.affiliate_earnings_log(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

GRANT SELECT ON public.affiliate_earnings_log TO authenticated;
GRANT ALL ON public.affiliate_earnings_log TO service_role;
ALTER TABLE public.affiliate_earnings_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin sees own earnings"
  ON public.affiliate_earnings_log FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- 3) withdraw_requests
CREATE TABLE IF NOT EXISTS public.withdraw_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  notes text,
  paid_at timestamptz,
  paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_status ON public.withdraw_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_user ON public.withdraw_requests(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.withdraw_requests TO authenticated;
GRANT ALL ON public.withdraw_requests TO service_role;
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own withdraw requests"
  ON public.withdraw_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin updates withdraw requests"
  ON public.withdraw_requests FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_withdraw_requests_updated
  BEFORE UPDATE ON public.withdraw_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) RPC: creditar comissão (usado pelo webhook Stripe via service role)
CREATE OR REPLACE FUNCTION public.credit_affiliate_commission(
  _payer_id uuid,
  _gross_amount numeric,
  _source_type text,
  _stripe_session text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid;
  _commission numeric(12,2);
BEGIN
  SELECT referred_by_admin_id INTO _admin FROM public.profiles WHERE id = _payer_id;
  IF _admin IS NULL OR _admin = _payer_id THEN
    RETURN 0;
  END IF;
  IF _gross_amount IS NULL OR _gross_amount <= 0 THEN
    RETURN 0;
  END IF;

  _commission := round(_gross_amount * 0.10, 2);

  BEGIN
    INSERT INTO public.affiliate_earnings_log
      (admin_id, referred_user_id, source_type, stripe_session_id, gross_amount, commission_amount)
    VALUES (_admin, _payer_id, _source_type, _stripe_session, _gross_amount, _commission);
  EXCEPTION WHEN unique_violation THEN
    RETURN 0;
  END;

  UPDATE public.profiles
    SET affiliate_balance = affiliate_balance + _commission
    WHERE id = _admin;

  INSERT INTO public.notifications (user_id, kind, title, body, link, source_type, source_id)
  VALUES (
    _admin,
    'affiliate_earning',
    '💰 Você recebeu uma comissão!',
    'Um convidado seu comprou e você ganhou R$ ' || _commission::text || ' no Programa de Parceiros.',
    '/settings',
    'affiliate',
    _admin
  );

  RETURN _commission;
END;
$$;

-- 5) RPC: solicitar saque
CREATE OR REPLACE FUNCTION public.request_withdraw(_pix_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bal numeric(12,2);
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF _pix_key IS NULL OR length(trim(_pix_key)) < 4 THEN
    RAISE EXCEPTION 'Chave Pix inválida.';
  END IF;

  SELECT affiliate_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal IS NULL OR _bal < 50 THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saque mínimo: R$ 50,00.';
  END IF;

  INSERT INTO public.withdraw_requests (user_id, amount, pix_key, status)
  VALUES (_uid, _bal, trim(_pix_key), 'pending')
  RETURNING id INTO _id;

  UPDATE public.profiles SET affiliate_balance = 0 WHERE id = _uid;

  RETURN _id;
END;
$$;

-- 6) RPC: marcar como pago (super admin)
CREATE OR REPLACE FUNCTION public.mark_withdraw_paid(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _target uuid;
BEGIN
  IF _uid IS NULL OR NOT public.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'Apenas super admins podem marcar como pago.';
  END IF;
  UPDATE public.withdraw_requests
    SET status = 'paid', paid_at = now(), paid_by = _uid
    WHERE id = _id AND status = 'pending'
    RETURNING user_id INTO _target;
  IF _target IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado.';
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, link, source_type, source_id)
  VALUES (
    _target,
    'withdraw_paid',
    '✅ Seu saque foi pago!',
    'O Pix da sua comissão do Programa de Parceiros foi enviado.',
    '/settings',
    'withdraw',
    _id
  );
END;
$$;

-- 7) Atualiza join_challenge_by_invite para gravar referred_by_admin_id no PRIMEIRO desafio
CREATE OR REPLACE FUNCTION public.join_challenge_by_invite(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _challenge_id uuid;
  _is_active boolean;
  _owner_id uuid;
  _owner_is_bot boolean;
  _user_id uuid := auth.uid();
  _has_previous boolean;
  _current_ref uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT c.id, c.is_active, c.owner_id
    INTO _challenge_id, _is_active, _owner_id
  FROM public.challenges c
  WHERE upper(trim(c.invite_code)) = upper(trim(_code))
    AND c.invite_enabled = true
  LIMIT 1;

  IF _challenge_id IS NULL THEN
    RAISE EXCEPTION 'Código de convite não encontrado.';
  END IF;

  IF _is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Este convite foi desativado pelo dono do desafio.';
  END IF;

  -- Atribuição de "padrinho" (só no primeiro desafio da vida)
  SELECT referred_by_admin_id INTO _current_ref FROM public.profiles WHERE id = _user_id;
  IF _current_ref IS NULL AND _owner_id IS NOT NULL AND _owner_id <> _user_id THEN
    SELECT EXISTS (
      SELECT 1 FROM public.challenge_members WHERE user_id = _user_id
    ) INTO _has_previous;

    IF NOT _has_previous THEN
      SELECT COALESCE(is_bot, false) INTO _owner_is_bot FROM public.profiles WHERE id = _owner_id;
      IF NOT _owner_is_bot THEN
        UPDATE public.profiles
          SET referred_by_admin_id = _owner_id
          WHERE id = _user_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.challenge_members (challenge_id, user_id, role)
  VALUES (_challenge_id, _user_id, 'member')
  ON CONFLICT (challenge_id, user_id) DO NOTHING;

  RETURN _challenge_id;
END;
$function$;
