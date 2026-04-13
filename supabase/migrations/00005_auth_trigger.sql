-- Trigger: ao criar usuário no Supabase Auth, cria perfil + workspace + member
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  user_name text;
  workspace_slug text;
BEGIN
  -- Extrai nome do metadata ou email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Gera slug único baseado no email
  workspace_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
  -- Garante unicidade adicionando sufixo se necessário
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE slug = workspace_slug) THEN
    workspace_slug := workspace_slug || '-' || substr(NEW.id::text, 1, 8);
  END IF;

  -- 1. Cria perfil do usuário
  INSERT INTO public.users (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    user_name,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- 2. Cria workspace com trial Pro de 7 dias
  INSERT INTO public.workspaces (name, slug, plan, trial_ends_at)
  VALUES (
    user_name || '''s Workspace',
    workspace_slug,
    'pro',
    now() + interval '7 days'
  )
  RETURNING id INTO new_workspace_id;

  -- 3. Adiciona usuário como owner do workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted_at)
  VALUES (new_workspace_id, NEW.id, 'owner', now());

  -- 4. Cria preferências padrão
  INSERT INTO public.workspace_preferences (workspace_id)
  VALUES (new_workspace_id);

  RETURN NEW;
END;
$$;

-- Conecta ao evento de criação de usuário do Supabase Auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
