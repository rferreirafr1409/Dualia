// app/acces-tiers.tsx
//
// Gestion des accès tiers : grands-parents, nounous, école.
//
// PRINCIPE — Un tiers est rattaché au PARENT qui l'invite, pas à la famille.
// Isabelle a sa nounou, Ricardo a la sienne. Confier ses enfants à une nounou
// pendant son temps de garde est un acte usuel, que chaque parent décide seul :
// exiger l'accord des deux reviendrait à donner à l'autre un droit de regard
// sur l'organisation de son propre temps de garde.
//
// En contrepartie, aucun accès n'est caché : chaque parent voit la liste
// complète, y compris les accès ouverts par l'autre. Pas de veto, mais pas de
// surprise non plus — « je ne savais pas que cette personne avait accès aux
// informations de mes enfants » est la phrase qu'on veut rendre impossible.
// Seul le parent qui a ouvert un accès peut le révoquer.
//
// L'invitation passe par un LIEN, comme pour le second parent. Dualia n'envoie
// aucun e-mail : le parent transmet le lien par SMS, WhatsApp, ce qu'il veut.
// Mieux vaut un lien à copier qu'un e-mail promis qui n'arrive jamais.

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Platform, Alert,
  ActivityIndicator, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';
import type { RoleTiers, Tiers } from '../types';

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

// Base du lien d'invitation. En web on la déduit de l'adresse courante, ce qui
// marche aussi bien en local qu'une fois déployé sous /Dualia/.
function baseDuLien(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const chemin = window.location.pathname.replace(/\/[^/]*$/, '');
    return `${window.location.origin}${chemin}`;
  }
  return 'https://rferreirafr1409.github.io/Dualia';
}

function lienInvitation(token: string): string {
  return `${baseDuLien()}/rejoindre-acces?token=${token}`;
}

type Libelles = {
  enfantsConcernes: string;
  enfantsAide: string;
  aucunEnfant: string;
  choisirUnEnfant: string;
  lienTitre: string;
  lienTexte: (nom: string) => string;
  copier: string;
  copie: string;
  partager: string;
  termine: string;
  invitePar: (nom: string) => string;
  parVous: string;
  lienEnAttente: string;
  actifDepuis: (date: string) => string;
  expireLe: (date: string) => string;
  revoquerImpossible: (nom: string) => string;
  lienExpire: string;
  echecRevocation: string;
  creation: string;
  echecCreation: string;
  messagePartage: (nom: string, lien: string) => string;
};

const LIBELLES: Record<string, Libelles> = {
  fr: {
    enfantsConcernes: 'Enfants concernés',
    enfantsAide: "Cette personne ne verra que les enfants que vous cochez, et rien des autres.",
    aucunEnfant: "Aucun enfant enregistré. Ajoutez d'abord un enfant à votre espace familial.",
    choisirUnEnfant: 'Choisissez au moins un enfant.',
    lienTitre: 'Lien créé',
    lienTexte: (nom) => `Transmettez ce lien à ${nom}. Il est valable 14 jours et ne peut servir qu'une fois.`,
    copier: 'Copier le lien',
    copie: 'Lien copié',
    partager: 'Partager',
    termine: 'Terminé',
    invitePar: (nom) => `Invité par ${nom}`,
    parVous: 'Invité par vous',
    lienEnAttente: "Lien transmis, pas encore utilisé",
    actifDepuis: (date) => `Actif depuis le ${date}`,
    expireLe: (date) => `Lien valable jusqu'au ${date}`,
    revoquerImpossible: (nom) => `Seul ${nom} peut retirer cet accès.`,
    lienExpire: 'Lien expiré — créez un nouvel accès',
    echecRevocation: "L'accès n'a pas pu être retiré. Réessayez.",
    creation: 'Création…',
    echecCreation: "L'accès n'a pas pu être créé.",
    messagePartage: (nom, lien) =>
      `${nom}, voici votre accès Dualia. Ce lien est valable 14 jours : ${lien}`,
  },
  pt: {
    enfantsConcernes: 'Crianças abrangidas',
    enfantsAide: 'Esta pessoa só verá as crianças que assinalar, e nada das outras.',
    aucunEnfant: 'Nenhuma criança registada. Adicione primeiro uma criança ao seu espaço familiar.',
    choisirUnEnfant: 'Escolha pelo menos uma criança.',
    lienTitre: 'Ligação criada',
    lienTexte: (nom) => `Transmita esta ligação a ${nom}. É válida 14 dias e só pode ser usada uma vez.`,
    copier: 'Copiar a ligação',
    copie: 'Ligação copiada',
    partager: 'Partilhar',
    termine: 'Concluído',
    invitePar: (nom) => `Convidado por ${nom}`,
    parVous: 'Convidado por si',
    lienEnAttente: 'Ligação enviada, ainda não utilizada',
    actifDepuis: (date) => `Ativo desde ${date}`,
    expireLe: (date) => `Ligação válida até ${date}`,
    revoquerImpossible: (nom) => `Só ${nom} pode retirar este acesso.`,
    lienExpire: 'Ligação expirada — crie um novo acesso',
    echecRevocation: 'Não foi possível retirar o acesso. Tente de novo.',
    creation: 'A criar…',
    echecCreation: 'Não foi possível criar o acesso.',
    messagePartage: (nom, lien) =>
      `${nom}, aqui está o seu acesso Dualia. Esta ligação é válida 14 dias: ${lien}`,
  },
  es: {
    enfantsConcernes: 'Niños incluidos',
    enfantsAide: 'Esta persona solo verá los niños que marques, y nada de los demás.',
    aucunEnfant: 'Ningún niño registrado. Añade primero un niño a tu espacio familiar.',
    choisirUnEnfant: 'Elige al menos un niño.',
    lienTitre: 'Enlace creado',
    lienTexte: (nom) => `Envía este enlace a ${nom}. Es válido 14 días y solo puede usarse una vez.`,
    copier: 'Copiar el enlace',
    copie: 'Enlace copiado',
    partager: 'Compartir',
    termine: 'Hecho',
    invitePar: (nom) => `Invitado por ${nom}`,
    parVous: 'Invitado por ti',
    lienEnAttente: 'Enlace enviado, aún sin usar',
    actifDepuis: (date) => `Activo desde el ${date}`,
    expireLe: (date) => `Enlace válido hasta el ${date}`,
    revoquerImpossible: (nom) => `Solo ${nom} puede retirar este acceso.`,
    lienExpire: 'Enlace caducado — crea un nuevo acceso',
    echecRevocation: 'No se ha podido retirar el acceso. Inténtalo de nuevo.',
    creation: 'Creando…',
    echecCreation: 'No se ha podido crear el acceso.',
    messagePartage: (nom, lien) =>
      `${nom}, aquí tienes tu acceso Dualia. Este enlace es válido 14 días: ${lien}`,
  },
  en: {
    enfantsConcernes: 'Children covered',
    enfantsAide: 'This person will only see the children you tick, and nothing of the others.',
    aucunEnfant: 'No child registered yet. Add a child to your family space first.',
    choisirUnEnfant: 'Pick at least one child.',
    lienTitre: 'Link created',
    lienTexte: (nom) => `Send this link to ${nom}. It is valid for 14 days and can only be used once.`,
    copier: 'Copy the link',
    copie: 'Link copied',
    partager: 'Share',
    termine: 'Done',
    invitePar: (nom) => `Invited by ${nom}`,
    parVous: 'Invited by you',
    lienEnAttente: 'Link sent, not used yet',
    actifDepuis: (date) => `Active since ${date}`,
    expireLe: (date) => `Link valid until ${date}`,
    revoquerImpossible: (nom) => `Only ${nom} can remove this access.`,
    lienExpire: 'Link expired — create a new access',
    echecRevocation: 'The access could not be removed. Try again.',
    creation: 'Creating…',
    echecCreation: 'The access could not be created.',
    messagePartage: (nom, lien) =>
      `${nom}, here is your Dualia access. This link is valid for 14 days: ${lien}`,
  },
};

function formatDate(iso: string | undefined, langue: string): string {
  if (!iso) return '';
  const locale = langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR';
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AccesTiersScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].accesTiers;
  const l = LIBELLES[langue] ?? LIBELLES.fr;
  const tiers = useStore((s) => s.tiers);
  const enfants = useStore((s) => s.enfants);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const inviterTiers = useStore((s) => s.inviterTiers);
  const revoquerTiers = useStore((s) => s.revoquerTiers);

  const ROLES: { valeur: RoleTiers; label: string; desc: string; icone: keyof typeof Ionicons.glyphMap }[] = [
    { valeur: 'grand_parent', label: t.roleGrandParent, desc: t.roleGrandParentDesc, icone: 'people-outline' },
    { valeur: 'nounou', label: t.roleNounou, desc: t.roleNounouDesc, icone: 'person-outline' },
    { valeur: 'ecole_tiers', label: t.roleEcole, desc: t.roleEcoleDesc, icone: 'school-outline' },
  ];

  const [modalOuverte, setModalOuverte] = useState(false);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [roleChoisi, setRoleChoisi] = useState<RoleTiers>('grand_parent');
  const [peutEtreGardien, setPeutEtreGardien] = useState(false);
  const [enfantsChoisis, setEnfantsChoisis] = useState<string[]>([]);
  const [creation, setCreation] = useState(false);

  // Lien fraîchement créé, montré une fois. Il reste consultable ensuite
  // depuis la carte de l'accès tant qu'il n'a pas été utilisé.
  const [lienCree, setLienCree] = useState<{ nom: string; lien: string } | null>(null);
  const [lienCopie, setLienCopie] = useState(false);

  const tiersActifs = tiers.filter((tr) => tr.statut !== 'revoque');

  const basculerEnfant = (id: string) =>
    setEnfantsChoisis((actuels) =>
      actuels.includes(id) ? actuels.filter((e) => e !== id) : [...actuels, id]
    );

  const reinitialiser = () => {
    setNom('');
    setEmail('');
    setRoleChoisi('grand_parent');
    setPeutEtreGardien(false);
    setEnfantsChoisis([]);
  };

  const creerAcces = async () => {
    if (!nom.trim() || !email.trim()) {
      alertCompat(t.champsIncompletsTitre, t.champsIncompletsMsg);
      return;
    }
    if (enfantsChoisis.length === 0) {
      alertCompat(t.champsIncompletsTitre, l.choisirUnEnfant);
      return;
    }

    setCreation(true);
    try {
      const nouveauTiers: Tiers = {
        id: 'tiers-' + Date.now(),
        nom: nom.trim(),
        email: email.trim(),
        role: roleChoisi,
        statut: 'invite',
        invitePar: parentActif,
        creeLe: new Date().toISOString(),
        peutEtreGardien,
        enfantIds: enfantsChoisis,
      };
      const token = await inviterTiers(nouveauTiers, enfantsChoisis);
      if (!token) {
        alertCompat(t.champsIncompletsTitre, l.echecCreation);
        return;
      }
      setModalOuverte(false);
      setLienCree({ nom: nouveauTiers.nom, lien: lienInvitation(token) });
      setLienCopie(false);
      reinitialiser();
    } finally {
      setCreation(false);
    }
  };

  const copierLien = async (lien: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(lien);
        setLienCopie(true);
        return;
      } catch {
        // Presse-papiers refusé (page non sécurisée, permission) : le lien
        // reste affiché et sélectionnable juste au-dessus.
      }
    }
    alertCompat(l.copier, lien);
  };

  const partagerLien = async (nomTiers: string, lien: string) => {
    if (Platform.OS === 'web') {
      copierLien(lien);
      return;
    }
    try {
      await Share.share({ message: l.messagePartage(nomTiers, lien) });
    } catch {
      /* partage annulé */
    }
  };

  const demanderRevocation = (tr: Tiers) => {
    if (tr.invitePar !== parentActif) {
      alertCompat(t.revoquerConfirmTitre, l.revoquerImpossible(parents[tr.invitePar]?.nom ?? ''));
      return;
    }
    const confirmer = async () => {
      const retire = await revoquerTiers(tr.id);
      if (!retire) alertCompat(t.revoquerConfirmTitre, l.echecRevocation);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t.revoquerConfirmMsg(tr.nom))) confirmer();
      return;
    }
    Alert.alert(t.revoquerConfirmTitre, t.revoquerConfirmMsg(tr.nom), [
      { text: t.annuler, style: 'cancel' },
      { text: t.revoquer, style: 'destructive', onPress: confirmer },
    ]);
  };

  const roleInfo = (role: RoleTiers) => ROLES.find((r) => r.valeur === role) ?? ROLES[0];

  const prenomsDe = (ids: string[]) =>
    ids
      .map((id) => enfants.find((e) => e.id === id)?.prenom)
      .filter(Boolean)
      .join(' · ');

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>{t.titre}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t.intro}</Text>

        {tiersActifs.length === 0 ? (
          <View style={styles.videCard}>
            <Ionicons name="people-outline" size={28} color={COLORS.ardoise} />
            <Text style={styles.videTexte}>{t.vide}</Text>
          </View>
        ) : (
          tiersActifs.map((tr) => {
            const info = roleInfo(tr.role);
            const parMoi = tr.invitePar === parentActif;
            const enAttente = !tr.accepteLe;
            // Un lien passé ses 14 jours ne sert plus à rien : le proposer à la
            // copie enverrait le destinataire sur un écran « lien invalide ».
            const expire = enAttente && !!tr.expireLe && new Date(tr.expireLe) < new Date();
            return (
              <View key={tr.id} style={styles.tiersCard}>
                <View style={styles.tiersIconWrap}>
                  <Ionicons name={info.icone} size={20} color={COLORS.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tiersNom}>{tr.nom}</Text>
                  <Text style={styles.tiersRole}>{info.label}</Text>

                  {tr.enfantIds.length > 0 ? (
                    <Text style={styles.tiersEnfants}>{prenomsDe(tr.enfantIds)}</Text>
                  ) : null}

                  <Text style={styles.tiersOrigine}>
                    {parMoi ? l.parVous : l.invitePar(parents[tr.invitePar]?.nom ?? '')}
                  </Text>

                  {tr.peutEtreGardien ? (
                    <Text style={styles.tiersGardienBadge}>{t.peutEtreGardien}</Text>
                  ) : null}

                  {expire ? (
                    <Text style={styles.tiersStatutExpire}>{l.lienExpire}</Text>
                  ) : enAttente ? (
                    <>
                      <Text style={styles.tiersStatutInvite}>{l.lienEnAttente}</Text>
                      {tr.expireLe ? (
                        <Text style={styles.tiersOrigine}>{l.expireLe(formatDate(tr.expireLe, langue))}</Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.tiersStatutActif}>{l.actifDepuis(formatDate(tr.accepteLe, langue))}</Text>
                  )}

                  {/* Le lien ne reste proposé que tant qu'il peut servir. */}
                  {parMoi && enAttente && !expire && tr.token ? (
                    <View style={styles.lienRangee}>
                      <Pressable
                        style={styles.lienBtn}
                        onPress={() => copierLien(lienInvitation(tr.token as string))}
                      >
                        <Ionicons name="link-outline" size={14} color={COLORS.vert} />
                        <Text style={styles.lienBtnTexte}>{l.copier}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.lienBtn}
                        onPress={() => partagerLien(tr.nom, lienInvitation(tr.token as string))}
                      >
                        <Ionicons name="share-outline" size={14} color={COLORS.vert} />
                        <Text style={styles.lienBtnTexte}>{l.partager}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {parMoi ? (
                  <Pressable onPress={() => demanderRevocation(tr)} hitSlop={10} style={styles.revoquerBtn}>
                    <Text style={styles.revoquerTexte}>{t.revoquer}</Text>
                  </Pressable>
                ) : (
                  <Ionicons name="eye-outline" size={16} color={COLORS.ardoise} />
                )}
              </View>
            );
          })
        )}

        <Pressable style={styles.ajouterBtn} onPress={() => setModalOuverte(true)}>
          <Ionicons name="add" size={18} color={COLORS.blanc} />
          <Text style={styles.ajouterTexte}>{t.inviterAcces}</Text>
        </Pressable>
      </ScrollView>

      {/* Formulaire d'invitation */}
      <Modal visible={modalOuverte} animationType="slide" transparent onRequestClose={() => setModalOuverte(false)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitre}>{t.modalTitre}</Text>

              <Text style={styles.label}>{t.champRole}</Text>
              {ROLES.map((r) => (
                <Pressable
                  key={r.valeur}
                  style={[styles.roleOption, roleChoisi === r.valeur && styles.roleOptionActive]}
                  onPress={() => setRoleChoisi(r.valeur)}
                >
                  <Ionicons name={r.icone} size={18} color={roleChoisi === r.valeur ? COLORS.vert : COLORS.ardoise} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleLabel, roleChoisi === r.valeur && styles.roleLabelActive]}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                  {roleChoisi === r.valeur ? <Ionicons name="checkmark-circle" size={18} color={COLORS.vert} /> : null}
                </Pressable>
              ))}

              <Text style={styles.label}>{t.champNom}</Text>
              <TextInput
                style={styles.input}
                value={nom}
                onChangeText={setNom}
                placeholder={t.nomPlaceholder}
                placeholderTextColor={COLORS.ardoise}
              />

              <Text style={styles.label}>{t.champEmail}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t.emailPlaceholder}
                placeholderTextColor={COLORS.ardoise}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              {/* Le périmètre, enfant par enfant. Jamais « tous » par défaut. */}
              <Text style={styles.label}>{l.enfantsConcernes}</Text>
              {enfants.length === 0 ? (
                <Text style={styles.aide}>{l.aucunEnfant}</Text>
              ) : (
                <>
                  <View style={styles.pucesEnfants}>
                    {enfants.map((e) => {
                      const actif = enfantsChoisis.includes(e.id);
                      return (
                        <Pressable
                          key={e.id}
                          style={[styles.puceEnfant, actif && styles.puceEnfantActive]}
                          onPress={() => basculerEnfant(e.id)}
                        >
                          <Ionicons
                            name={actif ? 'checkmark-circle' : 'ellipse-outline'}
                            size={15}
                            color={actif ? COLORS.blanc : COLORS.ardoise}
                          />
                          <Text style={[styles.puceEnfantTexte, actif && styles.puceEnfantTexteActive]}>
                            {e.prenom}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.aide}>{l.enfantsAide}</Text>
                </>
              )}

              <Pressable style={styles.gardienToggle} onPress={() => setPeutEtreGardien((v) => !v)}>
                <Ionicons
                  name={peutEtreGardien ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={peutEtreGardien ? COLORS.vert : COLORS.ardoise}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.gardienToggleTitre}>{t.gardienToggleTitre}</Text>
                  <Text style={styles.gardienToggleDesc}>{t.gardienToggleDesc}</Text>
                </View>
              </Pressable>

              <View style={styles.modalBtns}>
                <Pressable
                  style={styles.modalBtnAnnuler}
                  onPress={() => setModalOuverte(false)}
                  disabled={creation}
                >
                  <Text style={styles.modalBtnAnnulerTexte}>{t.annuler}</Text>
                </Pressable>
                <Pressable style={styles.modalBtnEnvoyer} onPress={creerAcces} disabled={creation}>
                  {creation ? (
                    <ActivityIndicator color={COLORS.blanc} />
                  ) : (
                    <Text style={styles.modalBtnEnvoyerTexte}>{t.envoyerInvitation}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Le lien, montré juste après la création */}
      <Modal visible={!!lienCree} animationType="slide" transparent onRequestClose={() => setLienCree(null)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <Text style={styles.modalTitre}>{l.lienTitre}</Text>
            <Text style={styles.intro}>{lienCree ? l.lienTexte(lienCree.nom) : ''}</Text>

            {/* Champ sélectionnable : si le presse-papiers est refusé, le lien
                reste copiable à la main plutôt que perdu. */}
            <TextInput
              style={[styles.input, styles.inputLien]}
              value={lienCree?.lien ?? ''}
              editable={false}
              multiline
              selectTextOnFocus
            />

            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalBtnAnnuler}
                onPress={() => lienCree && partagerLien(lienCree.nom, lienCree.lien)}
              >
                <Text style={styles.modalBtnAnnulerTexte}>{l.partager}</Text>
              </Pressable>
              <Pressable
                style={styles.modalBtnEnvoyer}
                onPress={() => lienCree && copierLien(lienCree.lien)}
              >
                <Text style={styles.modalBtnEnvoyerTexte}>{lienCopie ? l.copie : l.copier}</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setLienCree(null)} style={styles.termineBtn}>
              <Text style={styles.termineTexte}>{l.termine}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
  },
  topbarTitre: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond },
  contenu: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
  intro: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, lineHeight: 19, marginBottom: SPACING.lg },

  videCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    borderStyle: 'dashed', padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  videTexte: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, textAlign: 'center' },

  tiersCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  tiersIconWrap: {
    width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: '#F3E9E4',
    alignItems: 'center', justifyContent: 'center',
  },
  tiersNom: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.vertProfond },
  tiersRole: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 1 },
  tiersEnfants: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.vert, marginTop: 3 },
  tiersOrigine: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 3 },
  tiersStatutInvite: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.or, marginTop: 3 },
  tiersStatutExpire: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.terracotta, marginTop: 3 },
  tiersStatutActif: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.vert, marginTop: 3 },
  tiersGardienBadge: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.vert, marginTop: 3 },

  lienRangee: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  lienBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  lienBtnTexte: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.vert },

  gardienToggle: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: COLORS.blanc,
    borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md,
  },
  gardienToggleTitre: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },
  gardienToggleDesc: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 1 },
  revoquerBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  revoquerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.terracotta },

  ajouterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, marginTop: SPACING.md,
  },
  ajouterTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.blanc },

  modalFond: { flex: 1, backgroundColor: 'rgba(28,43,37,0.45)', justifyContent: 'flex-end' },
  modalCarte: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING.xl, maxHeight: '88%',
  },
  modalTitre: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond, marginBottom: SPACING.md },
  label: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond, marginBottom: 6, marginTop: SPACING.md },
  aide: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, lineHeight: 16, marginTop: 6 },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12, fontFamily: FONTS.body, fontSize: 15, color: COLORS.vertProfond,
  },
  inputLien: { fontSize: 12.5, minHeight: 64, color: COLORS.ardoise },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.blanc,
  },
  roleOptionActive: { borderColor: COLORS.vert, backgroundColor: '#EEF4F1' },
  roleLabel: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },
  roleLabelActive: { color: COLORS.vert },
  roleDesc: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 1 },

  pucesEnfants: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  puceEnfant: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.full, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.blanc,
  },
  puceEnfantActive: { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond },
  puceEnfantTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  puceEnfantTexteActive: { color: COLORS.blanc },

  modalBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  modalBtnAnnuler: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure },
  modalBtnAnnulerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.ardoise },
  modalBtnEnvoyer: { flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.vert },
  modalBtnEnvoyerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
  termineBtn: { alignItems: 'center', paddingVertical: SPACING.md, marginTop: SPACING.sm },
  termineTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vert },
});
