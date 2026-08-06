
-- ========= profiles: campos de monetização =========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fitcoins_balance INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS equipped_border TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS equipped_border_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS equipped_title TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS equipped_title_until TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ========= challenges: limites =========
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS member_limit INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;

-- ========= ai_usage_logs =========
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('chat','vision')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_ai_usage_select" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_type_time
  ON public.ai_usage_logs(user_id, usage_type, created_at DESC);

-- ========= fitcoin_transactions =========
CREATE TABLE IF NOT EXISTS public.fitcoin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fitcoin_transactions TO authenticated;
GRANT ALL ON public.fitcoin_transactions TO service_role;

ALTER TABLE public.fitcoin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_fitcoin_tx_select" ON public.fitcoin_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fitcoin_tx_user_time
  ON public.fitcoin_transactions(user_id, created_at DESC);

-- ========= stripe_events (idempotência) =========
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

GRANT ALL ON public.stripe_events TO service_role;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- sem policies: apenas service_role acessa

-- ========= RPC: spend_fitcoins (débito atômico) =========
CREATE OR REPLACE FUNCTION public.spend_fitcoins(_user_id UUID, _amount INT, _reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance INT;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Valor inválido.'; END IF;
  UPDATE public.profiles
    SET fitcoins_balance = fitcoins_balance - _amount
    WHERE id = _user_id AND fitcoins_balance >= _amount
    RETURNING fitcoins_balance INTO _new_balance;
  IF _new_balance IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.fitcoin_transactions (user_id, delta, reason)
    VALUES (_user_id, -_amount, _reason);
  RETURN true;
END;
$$;

-- ========= RPC: credit_fitcoins =========
CREATE OR REPLACE FUNCTION public.credit_fitcoins(_user_id UUID, _amount INT, _reason TEXT, _stripe_session TEXT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new INT;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Valor inválido.'; END IF;
  UPDATE public.profiles
    SET fitcoins_balance = fitcoins_balance + _amount
    WHERE id = _user_id
    RETURNING fitcoins_balance INTO _new;
  INSERT INTO public.fitcoin_transactions (user_id, delta, reason, stripe_session_id)
    VALUES (_user_id, _amount, _reason, _stripe_session);
  RETURN _new;
END;
$$;

-- ========= RPC: grant_pro =========
CREATE OR REPLACE FUNCTION public.grant_pro(_user_id UUID, _days INT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _until TIMESTAMPTZ;
BEGIN
  UPDATE public.profiles
    SET is_pro = true,
        pro_until = GREATEST(COALESCE(pro_until, now()), now()) + (_days || ' days')::interval
    WHERE id = _user_id
    RETURNING pro_until INTO _until;
  -- promove desafios de que é dono
  UPDATE public.challenges
    SET is_pro = true, member_limit = 300
    WHERE owner_id = _user_id;
  RETURN _until;
END;
$$;

-- ========= RPC: revoke_pro (chamado no expire) =========
CREATE OR REPLACE FUNCTION public.revoke_pro(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
    SET is_pro = false, pro_until = NULL
    WHERE id = _user_id;
  UPDATE public.challenges
    SET is_pro = false, member_limit = LEAST(member_limit, 20)
    WHERE owner_id = _user_id;
END;
$$;

-- ========= RPC: contadores de uso de IA =========
CREATE OR REPLACE FUNCTION public.ai_usage_count_today(_user_id UUID, _kind TEXT)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM public.ai_usage_logs
  WHERE user_id = _user_id
    AND usage_type = _kind
    AND created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo';
$$;

CREATE OR REPLACE FUNCTION public.ai_usage_count_month(_user_id UUID, _kind TEXT)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM public.ai_usage_logs
  WHERE user_id = _user_id
    AND usage_type = _kind
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
$$;
