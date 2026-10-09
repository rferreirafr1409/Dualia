// lib/consentementSante.ts
//
// Consentement explicite aux donnees de sante d'un enfant (DUA-103).
// La politique de confidentialite (section 3) promet un consentement
// explicite pour cette categorie particuliere de donnees ; il est recueilli
// une fois par parent, a la premiere saisie, et date dans parents.
// consentement_sante_at.

import { supabase } from '../constants/supabase';

export async function lireConsentementSante(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from('parents')
    .select('consentement_sante_at')
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data?.consentement_sante_at;
}

export async function enregistrerConsentementSante(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('session_requise');
  const { error } = await supabase
    .from('parents')
    .update({ consentement_sante_at: new Date().toISOString() })
    .eq('user_id', uid);
  if (error) throw error;
}
