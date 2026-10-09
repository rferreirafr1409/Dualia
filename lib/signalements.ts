// lib/signalements.ts
//
// Signaler un message de l'autre parent (DUA-102). Apple attend qu'une
// application ou des personnes s'ecrivent offre un moyen de signaler un
// contenu. La messagerie est privee entre co-parents, mais un message
// insultant ou menacant doit pouvoir etre porte a notre connaissance : le
// signalement est journalise dans signalements_messages, que l'equipe relit.

import { supabase } from '../constants/supabase';

export type MotifSignalement = 'inapproprie' | 'harcelement' | 'autre';

export async function signalerMessage(args: {
  familleId: string;
  messageId: string;
  signaleParUuid: string;
  motif: MotifSignalement;
  extrait: string;
}): Promise<void> {
  const { error } = await supabase.from('signalements_messages').insert({
    famille_id: args.familleId,
    message_id: args.messageId,
    signale_par: args.signaleParUuid,
    motif: args.motif,
    // Un extrait court suffit a l'equipe pour retrouver le message ; on ne
    // duplique pas le contenu complet dans une seconde table.
    extrait: args.extrait.slice(0, 200),
  });
  if (error) throw error;
}
