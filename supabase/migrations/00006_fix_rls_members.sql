-- Fix: permite que usuário veja suas próprias memberships
-- A policy anterior usava is_workspace_member() que criava dependência circular
DROP POLICY IF EXISTS members_read ON public.workspace_members;
CREATE POLICY members_read ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_workspace_member(workspace_id)
  );
