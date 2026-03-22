-- Resolve agent wallet from public profile URL segment (wallet address or case-insensitive name)

CREATE OR REPLACE FUNCTION public.resolve_agent_wallet_from_public_id(p_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id TEXT := trim(p_id);
  w TEXT;
BEGIN
  IF v_id = '' THEN
    RETURN NULL;
  END IF;

  SELECT a.wallet INTO w FROM agents a WHERE a.wallet = v_id LIMIT 1;
  IF FOUND THEN
    RETURN w;
  END IF;

  SELECT a.wallet INTO w
  FROM agents a
  WHERE lower(btrim(a.name)) = lower(btrim(v_id))
  LIMIT 1;

  RETURN w;
END;
$$;

COMMENT ON FUNCTION public.resolve_agent_wallet_from_public_id(TEXT) IS
  'Maps /agent/:id URL segment to agents.wallet: exact wallet first, else case-insensitive name';

GRANT EXECUTE ON FUNCTION public.resolve_agent_wallet_from_public_id(TEXT) TO service_role;
