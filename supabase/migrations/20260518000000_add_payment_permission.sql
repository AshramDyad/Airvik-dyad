UPDATE public.roles
SET permissions = array_append(permissions, 'read:payment')
WHERE permissions IS NOT NULL
  AND 'read:report' = ANY (permissions)
  AND NOT ('read:payment' = ANY (permissions));
