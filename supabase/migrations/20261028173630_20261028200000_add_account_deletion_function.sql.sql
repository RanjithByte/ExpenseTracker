/*
# Add secure account deletion

1. Purpose
Adds a server-side function that permanently removes the currently signed-in account after the browser has re-authenticated the user.

2. New Functions
- `delete_current_account()` deletes only the account identified by `auth.uid()`.
- Related user-owned businesses and their dependent financial records are removed by existing foreign-key cascades.

3. Security
- The function runs with controlled definer privileges and uses `auth.uid()` rather than a user-supplied account identifier.
- The function has a fixed `search_path`.
- Anonymous callers cannot execute it; authenticated callers may execute it for their own current session only.

4. Important Notes
- Password verification happens before this function is called through Supabase Auth re-authentication.
- The function does not accept an email address or user ID parameter, preventing account-target substitution.
- Account deletion is permanent and should be preceded by an explicit confirmation in the interface.
*/

CREATE OR REPLACE FUNCTION public.delete_current_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users
  WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_current_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_current_account() TO authenticated;
