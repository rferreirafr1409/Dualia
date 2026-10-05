// app/validation-cadre.tsx
//
// Écran de validation clause par clause du cadre familial. Accessible :
// 1. Depuis JugementUpload, juste après une extraction de convention.
// 2. Plus tard, depuis Finances → « Votre cadre familial » (à câbler dans
//    une prochaine étape), pour revoir ou modifier les règles.
//
// Règle métier stricte : tant que CadreFamilial.statut !== 'valide', aucune
// règle ici présente ne doit être utilisée ailleurs (Finances, Calendrier,
// Décisions) pour calculer quoi que ce soit automatiquement.
//
// Ce qui a changé sur le volet garde, et pourquoi :
//
// — Le mode de garde n'apparaissait plus du tout ici. L'écran d'extraction
//   l'affichait en entier, puis le cadre familial partait sans lui : cet
//   écran ne pouvait donc afficher qu'un bandeau générique, et plus rien
//   après un rechargement. C'est pourtant la première question que pose un
//   avocat — « qu'est-ce que votre outil a lu de mon jugement ? ». Les
//   clauses lues sont désormais affichées, avec leur citation.
//
// — L'écran annonçait « Calendrier généré » dès que le cadre était validé,
//   sans jamais savoir si quelque chose avait été généré. Quand le parent
//   de résidence n'était pas déterminé, le store ne créait rien — à raison —
//   et l'écran affirmait le contraire. Il lit maintenant le verdict
//   enregistré, et propose de réparer.
//
// — La détection du régime de garde était réécrite ici, différemment du
//   store. Les deux pouvaient donc se contredire. Elle vit dans une seule
//   fonction, planifierGarde, partagée.

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { planifierGarde, NOTES_JUGEMENT } from '../lib/gardeJugement';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { libellesConditions, listerConditions, aDesConditions } from '../lib/conditionsCadre';
import { formatMontant } from '../lib/comptes';
import { TRADUCTIONS } from '../constants/i18n';
import type {
  CategorieRegle,
  NiveauConfiance,
  ReglePartage,
  ParentRole,
  RegimeGardeConfirme,
  VerdictFinalisation,
  VerdictGarde,
} from '../types';
import { retour } from '../lib/navigation';
import type { VerdictVacances } from '../types';

// Le verdict des vacances scolaires, dit honnêtement.
//
// `constants/i18n.ts` porte `verdictVacances`, qui écrit en toutes lettres
// « (zone C, académie de Créteil) » dans les quatre langues. C'était exact
// tant que les dates étaient codées en dur pour cette seule zone. Ça ne l'est
// plus : la zone vient maintenant du jeu de données officiel, et elle dépend
// du code postal du foyer. Cette clé mentirait à toute famille hors zone C.
//
// Et « 0 repère ajouté » ne disait rien de la raison. Un parent sans code
// postal, un service de l'Éducation nationale en panne, et des repères déjà
// posés produisaient le même zéro muet.
const LIBELLES_VACANCES = {
  fr: {
    ok: (n: number, zone: string, academie: string) =>
      `${n} repère${n > 1 ? 's' : ''} de vacances scolaires ajouté${n > 1 ? 's' : ''} — ${zone}, académie de ${academie}.`,
    okSansZone: (n: number, academie: string) =>
      `${n} repère${n > 1 ? 's' : ''} de vacances scolaires ajouté${n > 1 ? 's' : ''} — académie de ${academie}.`,
    aucunNouveau: 'Vacances scolaires : les repères étaient déjà posés.',
    aucunFoyer: "Vacances scolaires non ajoutées : aucun foyer n'est renseigné.",
    codePostalAbsent: (foyer: string) =>
      `Vacances scolaires non ajoutées : le foyer « ${foyer} » n'a pas de code postal.`,
    horsFrance: (foyer: string, cp: string) =>
      `Vacances scolaires non ajoutées : « ${foyer} » (${cp}) ne relève pas d'une académie française.`,
    indisponible:
      "Vacances scolaires non ajoutées : le calendrier officiel de l'Éducation nationale n'a pas répondu. À relancer plus tard.",
    aucunePeriode: (academie: string) =>
      `Vacances scolaires non ajoutées : aucune période publiée pour l'académie de ${academie}.`,
    source: (source: string, le: string) => `${source} — relevé le ${le}`,
  },
  es: {
    ok: (n: number, zone: string, academie: string) =>
      `${n} marca${n > 1 ? 's' : ''} de vacaciones escolares añadida${n > 1 ? 's' : ''} — ${zone}, academia de ${academie}.`,
    okSansZone: (n: number, academie: string) =>
      `${n} marca${n > 1 ? 's' : ''} de vacaciones escolares añadida${n > 1 ? 's' : ''} — academia de ${academie}.`,
    aucunNouveau: 'Vacaciones escolares: las marcas ya estaban puestas.',
    aucunFoyer: 'Vacaciones escolares no añadidas: no hay ningún domicilio registrado.',
    codePostalAbsent: (foyer: string) =>
      `Vacaciones escolares no añadidas: el domicilio «${foyer}» no tiene código postal.`,
    horsFrance: (foyer: string, cp: string) =>
      `Vacaciones escolares no añadidas: «${foyer}» (${cp}) no depende de una academia francesa.`,
    indisponible:
      'Vacaciones escolares no añadidas: el calendario oficial francés no respondió. Vuelve a intentarlo más tarde.',
    aucunePeriode: (academie: string) =>
      `Vacaciones escolares no añadidas: ningún periodo publicado para la academia de ${academie}.`,
    source: (source: string, le: string) => `${source} — consultado el ${le}`,
  },
  pt: {
    ok: (n: number, zone: string, academie: string) =>
      `${n} marca${n > 1 ? 's' : ''} de férias escolares adicionada${n > 1 ? 's' : ''} — ${zone}, academia de ${academie}.`,
    okSansZone: (n: number, academie: string) =>
      `${n} marca${n > 1 ? 's' : ''} de férias escolares adicionada${n > 1 ? 's' : ''} — academia de ${academie}.`,
    aucunNouveau: 'Férias escolares: as marcas já estavam colocadas.',
    aucunFoyer: 'Férias escolares não adicionadas: nenhum domicílio registado.',
    codePostalAbsent: (foyer: string) =>
      `Férias escolares não adicionadas: o domicílio «${foyer}» não tem código postal.`,
    horsFrance: (foyer: string, cp: string) =>
      `Férias escolares não adicionadas: «${foyer}» (${cp}) não depende de uma academia francesa.`,
    indisponible:
      'Férias escolares não adicionadas: o calendário oficial francês não respondeu. Tente mais tarde.',
    aucunePeriode: (academie: string) =>
      `Férias escolares não adicionadas: nenhum período publicado para a academia de ${academie}.`,
    source: (source: string, le: string) => `${source} — consultado em ${le}`,
  },
  en: {
    ok: (n: number, zone: string, academie: string) =>
      `${n} school-holiday marker${n > 1 ? 's' : ''} added — ${zone}, ${academie} education authority.`,
    okSansZone: (n: number, academie: string) =>
      `${n} school-holiday marker${n > 1 ? 's' : ''} added — ${academie} education authority.`,
    aucunNouveau: 'School holidays: the markers were already in place.',
    aucunFoyer: 'School holidays not added: no household on record.',
    codePostalAbsent: (foyer: string) =>
      `School holidays not added: the household "${foyer}" has no postcode.`,
    horsFrance: (foyer: string, cp: string) =>
      `School holidays not added: "${foyer}" (${cp}) is not covered by a French education authority.`,
    indisponible:
      'School holidays not added: the official French calendar did not respond. Try again later.',
    aucunePeriode: (academie: string) =>
      `School holidays not added: no period published for the ${academie} education authority.`,
    source: (source: string, le: string) => `${source} — retrieved on ${le}`,
  },
} as const;

function phraseVacances(v: VerdictVacances, langue: 'fr' | 'es' | 'pt' | 'en'): string {
  const l = LIBELLES_VACANCES[langue];
  const academie = v.academie ?? '—';
  if (v.genere > 0) {
    return v.zone ? l.ok(v.genere, v.zone, academie) : l.okSansZone(v.genere, academie);
  }
  switch (v.motif) {
    case 'aucun_foyer':
      return l.aucunFoyer;
    case 'code_postal_absent':
      return l.codePostalAbsent(v.detail ?? '—');
    case 'hors_france': {
      const [foyer, cp] = String(v.detail ?? '').split(' — ');
      return l.horsFrance(foyer || '—', cp || '—');
    }
    case 'service_indisponible':
      return l.indisponible;
    case 'aucune_periode':
      return l.aucunePeriode(academie);
    default:
      return l.aucunNouveau;
  }
}

export default function ValidationCadreScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const lcCadre = libellesConditions(langue);
  // Exactement la même fonction que l'écran Finances : un plafond doit se lire
  // à l'identique là où on le valide et là où on l'applique. Dupliquer la mise
  // en forme, c'était laisser les deux écrans diverger à la première retouche.
  const formatMontantCadre = (n: number) => formatMontant(n, langue);
  const t = TRADUCTIONS[langue].validationCadre;
  const localeDate = langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR';

  const LABELS_CATEGORIE: Record<CategorieRegle, string> = {
    fraisMedicaux: t.categorieFraisMedicaux,
    fraisScolaires: t.categorieFraisScolaires,
    activitesExtra: t.categorieActivitesExtra,
    autre: t.categorieAutre,
  };

  const LABELS_CONFIANCE: Record<NiveauConfiance, { label: string; couleur: string }> = {
    haute: { label: t.confianceHaute, couleur: COLORS.vert },
    moyenne: { label: t.confianceMoyenne, couleur: COLORS.or },
    basse: { label: t.confianceBasse, couleur: COLORS.terracotta },
  };

  const cadreFamilial = useStore((s) => s.cadreFamilial);
  const validerRegle = useStore((s) => s.validerRegle);
  const rejeterRegle = useStore((s) => s.rejeterRegle);
  const modifierRegle = useStore((s) => s.modifierRegle);
  const finaliserCadreFamilial = useStore((s) => s.finaliserCadreFamilial);
  const confirmerRegimeGarde = useStore((s) => s.confirmerRegimeGarde);
  // Sert à vérifier qu'un calendrier annoncé existe encore vraiment.
  const evenementsGarde = useStore((s) => s.evenements);
  const parents = useStore((s) => s.parents);

  // Les deux réponses que Dualia ne déduit pas du texte du jugement, et
  // qu'il demande au parent à côté de la clause citée : chez qui la
  // résidence est fixée (ou résidence alternée), et la parité des
  // week-ends. Voir l'en-tête de lib/gardeJugement.ts pour la raison —
  // huit façons réalistes d'inverser un planning sur douze semaines.
  const [residence, setResidence] = useState<ParentRole | 'alternee' | null>(null);
  const [parite, setParite] = useState<'paires' | 'impaires' | null>(null);
  // Pas de valeur par défaut : « le parent A » coché d'avance en vert
  // serait pris pour une réponse, et douze semaines partiraient de ce
  // côté-là sans que personne ne l'ait dit.
  const [parentQuiCommence, setParentQuiCommence] = useState<ParentRole | null>(null);
  const [verdict, setVerdict] = useState<VerdictFinalisation | null>(null);
  const [verdictGarde, setVerdictGarde] = useState<VerdictGarde | null>(null);
  const [travailEnCours, setTravailEnCours] = useState(false);

  const [modifModalRegle, setModifModalRegle] = useState<ReglePartage | null>(null);
  const [partAInput, setPartAInput] = useState('');

  if (!cadreFamilial) {
    return (
      <View style={styles.screen}>
        <View style={styles.topbar}>
          <Pressable onPress={() => retour(router, '/(tabs)/documents')} style={styles.zoneTactile}>
            <Ionicons name="close" size={22} color={COLORS.vertProfond} />
          </Pressable>
          <Text style={styles.topbarTitre}>{t.titre}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.videWrap}>
          <Text style={styles.videTexte}>{t.videTexte}</Text>
        </View>
      </View>
    );
  }

  const regles = cadreFamilial.regles;
  const nbTotal = regles.length;
  const nbVerifiees = regles.filter((r) => r.validation.statut !== 'a_verifier').length;
  const toutEstVerifie = nbTotal > 0 && nbVerifiees === nbTotal;
  const dejaValide = cadreFamilial.statut === 'valide';

  const garde = cadreFamilial.garde;

  const nomParent = (id?: ParentRole) => (id ? parents[id]?.nom ?? '' : '');
  const autreParent = (id: ParentRole): ParentRole => (id === 'A' ? 'B' : 'A');
  const libelleParite = (p?: 'paires' | 'impaires') =>
    p === 'impaires' ? t.gardeWeekendsImpaires : p === 'paires' ? t.gardeWeekendsPaires : '—';

  const MOTIFS: Record<NonNullable<VerdictGarde['motif']>, string> = {
    aucune_garde: t.motifAucuneGarde,
    regime_non_confirme: t.motifRegimeNonConfirme,
    echec_enregistrement: t.motifEchecEnregistrement,
    non_tente: t.motifNonTente,
    calendrier_absent: t.motifCalendrierAbsent,
  };

  // Le régime déjà confirmé lors d'une session précédente, ou celui que le
  // parent est en train de composer sur cet écran.
  const regimeEnregistre = garde?.regimeConfirme;
  const regimeEnCours: RegimeGardeConfirme | null =
    residence === null
      ? null
      : residence === 'alternee'
      ? parentQuiCommence === null
        ? null
        : { residence: 'alternee', parentQuiCommence, confirmeLe: new Date().toISOString() }
      : parite === null
      ? null
      : { residence, parentQuiCommence: residence, parite, confirmeLe: new Date().toISOString() };

  // Dès que le parent touche aux questions, c'est SA réponse en cours qui
  // compte, et rien d'autre. Retomber sur le régime enregistré dès que la
  // réponse en cours était incomplète produisait le pire des cas : le
  // parent changeait de résidence, la question de parité se réinitialisait,
  // le bouton restait actif, et Dualia régénérait l'ancienne réponse
  // pendant que l'écran affichait la nouvelle en vert.
  const aCommenceARepondre = residence !== null;
  const regimeRetenu = aCommenceARepondre ? regimeEnCours : regimeEnregistre;

  // Ce qui serait généré à partir de là. Même fonction que celle qu'utilise
  // le store : ce qui est annoncé ici est ce qui sera fait.
  const plan = planifierGarde(garde, regimeRetenu ?? undefined);

  // Combien d'événements générés existent réellement. Un verdict
  // « généré » peut survivre à leur disparition — échec d'écriture du
  // verdict, ou suppression à la main dans l'Agenda — et l'écran
  // affirmerait alors un planning absent. On compte plutôt que de croire.
  // Seules les notes du jugement comptent. Le modèle composé à la main
  // depuis l'Agenda porte sa propre note : le confondre avec celui du
  // jugement faisait affirmer « 12 semaines générées : en semaine chez B,
  // week-ends des semaines paires chez A » à propos d'un planning manuel
  // qui avait remplacé celui du jugement.
  const evenementsGeneres = evenementsGarde.filter((e) => NOTES_JUGEMENT.includes(e.notes ?? '')).length;

  // Verdict de la session en cours s'il y en a un, sinon celui enregistré
  // lors d'une validation précédente. Un cadre déjà validé sans trace de
  // génération — validé depuis l'appareil de l'autre parent, ou hors ligne
  // — ne doit pas afficher le plan au futur : c'est déjà validé.
  const verdictBrut: VerdictGarde | null =
    verdictGarde ??
    garde?.generation ??
    (dejaValide && garde ? { statut: 'non_genere', motif: 'non_tente' } : null);

  const verdictAffiche: VerdictGarde | null =
    verdictBrut && verdictBrut.statut === 'genere' && evenementsGeneres === 0
      ? { statut: 'non_genere', motif: 'calendrier_absent' }
      : verdictBrut;

  const peutGenerer = plan.action !== 'rien';

  const finaliser = async () => {
    setTravailEnCours(true);
    try {
      const resultat = await finaliserCadreFamilial();
      let gardeFaite = resultat.garde;
      // La finalisation applique le régime déjà enregistré ; si le parent
      // vient d'en confirmer un sur cet écran, on l'applique ensuite.
      if (regimeEnCours) gardeFaite = await confirmerRegimeGarde(regimeEnCours);
      setVerdict({ ...resultat, garde: gardeFaite });
      setVerdictGarde(gardeFaite);
    } finally {
      setTravailEnCours(false);
    }
  };

  const genererMaintenant = async () => {
    if (!regimeRetenu) return;
    setTravailEnCours(true);
    try {
      setVerdictGarde(await confirmerRegimeGarde(regimeRetenu));
    } finally {
      setTravailEnCours(false);
    }
  };

  const ouvrirModif = (regle: ReglePartage) => {
    setModifModalRegle(regle);
    setPartAInput(String(regle.partA));
  };

  const confirmerModif = () => {
    if (!modifModalRegle) return;
    const partA = Math.max(0, Math.min(100, parseInt(partAInput, 10) || 0));
    const partB = 100 - partA;
    modifierRegle(modifModalRegle.id, { partA, partB });
    setModifModalRegle(null);
  };

  /** Une question, ses réponses possibles, et rien de pré-sélectionné. Une
   *  réponse cochée d'avance par Dualia serait un piège : le parent
   *  validerait la suggestion sans la vérifier, et c'est précisément la
   *  déduction dont on ne veut plus. */
  const Question = ({
    titre,
    options,
    valeur,
    surChoix,
  }: {
    titre: string;
    options: { cle: string; libelle: string }[];
    valeur: string | null;
    surChoix: (cle: string) => void;
  }) => (
    <View style={styles.choixBloc}>
      <Text style={styles.choixTitre}>{titre}</Text>
      <View style={styles.choixLigne}>
        {options.map((o) => (
          <Pressable
            key={o.cle}
            style={[styles.choixChip, valeur === o.cle && styles.choixChipActif]}
            onPress={() => surChoix(o.cle)}
          >
            <Text style={[styles.choixChipTexte, valeur === o.cle && styles.choixChipTexteActif]}>
              {o.libelle}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  /** Les questions que Dualia pose plutôt que d'y répondre lui-même. */
  const QuestionsRegime = () => (
    <>
      <Question
        titre={t.questionResidence}
        valeur={residence}
        options={[
          { cle: 'A', libelle: nomParent('A') },
          { cle: 'B', libelle: nomParent('B') },
          { cle: 'alternee', libelle: t.residenceAlternee },
        ]}
        surChoix={(cle) => {
          setResidence(cle as ParentRole | 'alternee');
          setParite(null);
        }}
      />

      {residence === 'alternee' && (
        <Question
          titre={t.questionQuiCetteSemaine}
          valeur={parentQuiCommence}
          options={[
            { cle: 'A', libelle: nomParent('A') },
            { cle: 'B', libelle: nomParent('B') },
          ]}
          surChoix={(cle) => setParentQuiCommence(cle as ParentRole)}
        />
      )}

      {(residence === 'A' || residence === 'B') && (
        <Question
          titre={t.questionParite(nomParent(autreParent(residence)))}
          valeur={parite}
          options={[
            { cle: 'paires', libelle: t.gardeWeekendsPaires },
            { cle: 'impaires', libelle: t.gardeWeekendsImpaires },
          ]}
          surChoix={(cle) => setParite(cle as 'paires' | 'impaires')}
        />
      )}
    </>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => retour(router, '/(tabs)/documents')} style={styles.zoneTactile}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>{t.titre}</Text>
        <View style={{ width: 22 }} />
      </View>

      {nbTotal > 0 && (
        <View style={styles.progressionWrap}>
          <Text style={styles.progressionTexte}>{t.progressionTexte(nbVerifiees, nbTotal)}</Text>
          <View style={styles.progressionBarreFond}>
            <View
              style={[
                styles.progressionBarreRemplie,
                { width: `${nbTotal === 0 ? 0 : (nbVerifiees / nbTotal) * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cadreFamilial.pension && (
          <View style={styles.pensionCard}>
            <Text style={styles.pensionEyebrow}>{t.pensionEyebrow}</Text>
            <Text style={styles.pensionMontant}>{cadreFamilial.pension.montant} {t.pensionParMois}</Text>
            {cadreFamilial.pension.montantParEnfant && cadreFamilial.pension.nombreEnfantsConcernes ? (
              <Text style={styles.pensionMeta}>
                {t.pensionParEnfant(cadreFamilial.pension.montantParEnfant, cadreFamilial.pension.nombreEnfantsConcernes)}
              </Text>
            ) : null}
            <Text style={styles.pensionMeta}>{t.pensionPeriodicite(cadreFamilial.pension.periodicite)}</Text>
          </View>
        )}

        {/* ---------- Mode de garde lu dans le jugement ---------- */}
        {garde && (
          <View style={styles.gardeCard}>
            <Text style={styles.gardeEyebrow}>{t.gardeEyebrow}</Text>

            <Champ label={t.gardeAutoriteParentale} valeur={garde.autoriteParentale} />
            <Champ label={t.gardeResidencePrincipale} valeur={garde.residencePrincipale} />
            <Champ label={t.gardeDroitVisite} valeur={garde.droitVisiteHebergementDescription} />
            <Champ label={t.gardeTransport} valeur={garde.transportAChargeDe} />
            <Champ label={t.gardeVacances} valeur={garde.vacancesScolaires} />
            <Champ label={t.gardeClausesVoyage} valeur={garde.clausesVoyage} />

            {garde.texteSource ? (
              <Text style={styles.citation}>« {garde.texteSource} »</Text>
            ) : null}

            {garde.confiance && LABELS_CONFIANCE[garde.confiance] ? (
              <View style={styles.confianceRow}>
                <View
                  style={[styles.confiancePuce, { backgroundColor: LABELS_CONFIANCE[garde.confiance].couleur }]}
                />
                <Text style={styles.confianceTexte}>{LABELS_CONFIANCE[garde.confiance].label}</Text>
              </View>
            ) : null}

            <View style={styles.separateur} />

            {/* ---------- Calendrier de garde ----------
                Dualia ne déduit pas le régime du texte : il affiche les
                clauses ci-dessus et demande de le confirmer. Voir
                lib/gardeJugement.ts pour les huit inversions qui ont mené
                à cette décision. */}
            <Text style={styles.gardeEyebrow}>{t.calendrierEyebrow}</Text>

            {verdictAffiche && verdictAffiche.statut === 'genere' ? (
              <>
                <View style={styles.resultatOk}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.vert} />
                  <Text style={styles.resultatOkTexte}>
                    {verdictAffiche.modele === 'alternee'
                      ? t.calendrierGenereAlternee(nomParent(verdictAffiche.parentId))
                      : t.calendrierGenereWeekend(
                          nomParent(verdictAffiche.parentId),
                          nomParent(verdictAffiche.parentId ? autreParent(verdictAffiche.parentId) : undefined),
                          libelleParite(regimeEnregistre?.parite).toLowerCase()
                        )}
                  </Text>
                </View>
                {/* Le planning suit le rythme ordinaire d'un bout à
                    l'autre : il ne retire ni les vacances scolaires ni les
                    dates spéciales, que le jugement partage autrement, et
                    il pose des journées entières. Le dire ici, plutôt que
                    de laisser un magistrat le découvrir sur un calendrier
                    de Noël. */}
                <Text style={styles.gardeNote}>{t.calendrierReserveVacances}</Text>
                {/* Cette réserve décrit un planning semaine + week-end :
                    elle n'a pas de sens pour une résidence alternée, dont
                    les blocs sont des semaines entières. */}
                {verdictAffiche.modele === 'weekend' ? (
                  <Text style={styles.gardeNote}>{t.calendrierReserveHoraires}</Text>
                ) : null}
                <Pressable style={styles.btnLien} onPress={() => router.push('/(tabs)/calendrier' as any)}>
                  <Text style={styles.btnLienTexte}>{t.voirAgenda}</Text>
                </Pressable>
              </>
            ) : (
              <>
                {verdictAffiche ? (
                  <>
                    <View style={styles.resultatNon}>
                      <Ionicons name="alert-circle-outline" size={18} color={COLORS.terracotta} />
                      <Text style={styles.resultatNonTexte}>{t.calendrierNonGenereTitre}</Text>
                    </View>
                    <Text style={styles.gardeTexte}>
                      {verdictAffiche.motif ? MOTIFS[verdictAffiche.motif] : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.gardeTexte}>{t.calendrierAConfirmer}</Text>
                )}

                {verdictAffiche?.motif === 'aucune_garde' ? null : (
                  <>
                    <QuestionsRegime />

                    {plan.action !== 'rien' ? (
                      <Text style={styles.gardeNote}>
                        {plan.action === 'alternee'
                          ? t.calendrierPlanAlternee(nomParent(plan.parentId))
                          : t.calendrierPlanWeekend(
                              nomParent(plan.parentId),
                              nomParent(autreParent(plan.parentId)),
                              libelleParite(plan.parite).toLowerCase()
                            )}
                      </Text>
                    ) : null}

                    {/* Avant validation, la génération part du bouton du
                        bas. Après, c'est ici qu'on la déclenche. */}
                    {dejaValide || verdict ? (
                      <Pressable
                        style={[
                          styles.btnGenerer,
                          (!peutGenerer || travailEnCours) && styles.btnDesactive,
                        ]}
                        disabled={!peutGenerer || travailEnCours}
                        onPress={genererMaintenant}
                      >
                        {travailEnCours ? (
                          <ActivityIndicator color={COLORS.blanc} />
                        ) : (
                          <Text style={styles.btnGenererTexte}>{t.btnGenerer}</Text>
                        )}
                      </Pressable>
                    ) : (
                      <Text style={styles.gardeNote}>{t.calendrierApresValidation}</Text>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* ---------- Dates spéciales ---------- */}
        {cadreFamilial.datesSpeciales && cadreFamilial.datesSpeciales.length > 0 && (
          <View style={styles.datesCard}>
            <Text style={styles.datesEyebrow}>{t.datesEyebrow}</Text>
            {cadreFamilial.datesSpeciales.map((d, i) => (
              <View key={i} style={styles.dateLigne}>
                <Text style={styles.dateOccasion}>{d.occasion}</Text>
                <Text style={styles.dateParent}>
                  {d.parent
                    ? nomParent(d.parent)
                    : d.parentGenre === 'mere'
                    ? t.dateChezLaMere
                    : d.parentGenre === 'pere'
                    ? t.dateChezLePere
                    : '—'}
                </Text>
              </View>
            ))}
            {verdict ? (
              <>
                <Text style={styles.datesResultat}>{t.verdictDatesSpeciales(verdict.datesSpeciales.genere)}</Text>
                {verdict.datesSpeciales.sansParent.length > 0 && (
                  <Text style={styles.datesAvertissement}>
                    {t.verdictDatesSansParent(verdict.datesSpeciales.sansParent.join(', '))}
                  </Text>
                )}
                {verdict.datesSpeciales.ignorees.length > 0 && (
                  <Text style={styles.datesAvertissement}>
                    {t.verdictDatesIgnorees(verdict.datesSpeciales.ignorees.join(', '))}
                  </Text>
                )}
              </>
            ) : (
              // Aucune affirmation hors session. Le verdict des dates
              // spéciales n'est pas enregistré, donc au rechargement l'écran
              // ne sait pas ce qui a été ajouté : il affirmait pourtant
              // « ajoutées automatiquement au calendrier partagé », y compris
              // quand aucune n'avait pu l'être faute de savoir chez quel
              // parent. Il renvoie désormais au calendrier, qui, lui, sait.
              <Text style={styles.datesResultat}>
                {dejaValide ? t.datesResultatAVerifier : t.datesResultatEnAttente}
              </Text>
            )}
          </View>
        )}

        {regles.length === 0 && <Text style={styles.videTexte}>{t.reglesVideTexte}</Text>}

        {regles.map((regle) => {
          const confiance = LABELS_CONFIANCE[regle.detection.confiance];
          const conditions = listerConditions(regle.conditions, langue, formatMontantCadre);
          const estDefautNonPrecise = regle.detection.confiance === 'basse' && !regle.clauseSource?.reference;

          return (
            <View key={regle.id} style={styles.regleCard}>
              <Text style={styles.regleTitre}>{LABELS_CATEGORIE[regle.categorie]}</Text>

              <View style={styles.repartitionRow}>
                <Text style={styles.repartitionTexte}>
                  {estDefautNonPrecise ? t.repartitionDefaut : t.repartitionDetectee}
                  <Text style={styles.repartitionValeur}>{regle.partA} % / {regle.partB} %</Text>
                </Text>
              </View>

              {estDefautNonPrecise && (
                <Text style={styles.avertissementDefaut}>{t.avertissementDefaut}</Text>
              )}

              {regle.clauseSource?.reference || regle.clauseSource?.extrait ? (
                <View style={styles.clauseBox}>
                  {regle.clauseSource.reference && (
                    <Text style={styles.clauseReference}>
                      {t.clauseSource(regle.clauseSource.reference)}
                      {regle.clauseSource.page ? t.clauseSourcePage(String(regle.clauseSource.page)) : ''}
                    </Text>
                  )}
                  {regle.clauseSource.extrait && (
                    <Text style={styles.clauseExtrait}>« {regle.clauseSource.extrait} »</Text>
                  )}
                </View>
              ) : null}

              {/* Conditions du jugement. Elles étaient extraites, enregistrées
                  en base, et montrées à personne : le parent validait « 60/40 »
                  sans voir « dans la limite de 400 €, déduction faite de la
                  mutuelle, sur justificatif ». Valider une règle dont on ne
                  voit pas les conditions, ce n'est pas valider. */}
              {aDesConditions(regle.conditions) ? (
                <View style={styles.conditionsBox}>
                  <Text style={styles.conditionsTitre}>{lcCadre.titre}</Text>
                  {conditions.map((ligne, i) => (
                    <View key={i} style={styles.conditionLigne}>
                      <Ionicons name="ellipse" size={5} color={COLORS.or} style={{ marginTop: 6 }} />
                      <Text style={styles.conditionTexte}>{ligne}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.confianceRow}>
                <View style={[styles.confiancePuce, { backgroundColor: confiance.couleur }]} />
                <Text style={styles.confianceTexte}>{confiance.label}</Text>
              </View>

              {regle.validation.statut === 'a_verifier' ? (
                <View style={styles.actionsRow}>
                  <Pressable style={styles.btnValider} onPress={() => validerRegle(regle.id)}>
                    <Text style={styles.btnValiderTexte}>{t.valider}</Text>
                  </Pressable>
                  <Pressable style={styles.btnSecondaire} onPress={() => ouvrirModif(regle)}>
                    <Text style={styles.btnSecondaireTexte}>{t.modifier}</Text>
                  </Pressable>
                  <Pressable style={styles.btnSecondaire} onPress={() => rejeterRegle(regle.id)}>
                    <Text style={styles.btnSecondaireTexte}>{t.rejeter}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.statutFinalRow}>
                  <Ionicons
                    name={regle.validation.statut === 'validee' ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={regle.validation.statut === 'validee' ? COLORS.vert : COLORS.ardoise}
                  />
                  <Text style={styles.statutFinalTexte}>
                    {regle.validation.statut === 'validee' ? t.valideeStatut : t.nonRetenueStatut}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {verdict && (
          <View style={styles.verdictCard}>
            <Text style={styles.verdictTitre}>{t.verdictTitre}</Text>
            <Text style={styles.verdictLigne}>{phraseVacances(verdict.vacances, langue)}</Text>
            {verdict.vacances.source && verdict.vacances.releveLe ? (
              <Text style={styles.verdictSource}>
                {LIBELLES_VACANCES[langue].source(
                  verdict.vacances.source,
                  new Date(verdict.vacances.releveLe).toLocaleDateString(localeDate)
                )}
              </Text>
            ) : null}
          </View>
        )}

        {dejaValide && !verdict && (
          <View style={styles.dejaValideBox}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.vert} />
            <Text style={styles.dejaValideTexte}>
              {t.dejaValideTexte(cadreFamilial.valideLe ? new Date(cadreFamilial.valideLe).toLocaleDateString(localeDate) : '')}
            </Text>
          </View>
        )}
      </ScrollView>

      {dejaValide || verdict ? (
        <Pressable style={styles.btnFinaliser} onPress={() => retour(router, '/(tabs)/documents')}>
          <Text style={styles.btnFinaliserTexte}>{t.btnTermine}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[
            styles.btnFinaliser,
            ((nbTotal > 0 && !toutEstVerifie) || travailEnCours) && styles.btnFinaliserDesactive,
          ]}
          disabled={(nbTotal > 0 && !toutEstVerifie) || travailEnCours}
          onPress={finaliser}
        >
          {travailEnCours ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.btnFinaliserTexte}>{t.btnFinaliser}</Text>
          )}
        </Pressable>
      )}

      <Modal visible={!!modifModalRegle} animationType="fade" transparent onRequestClose={() => setModifModalRegle(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitre}>{t.modalTitre}</Text>
            <Text style={styles.modalLabel}>{t.modalLabel}</Text>
            <TextInput
              style={styles.modalInput}
              value={partAInput}
              onChangeText={setPartAInput}
              keyboardType="number-pad"
              placeholder="50"
              placeholderTextColor={COLORS.ardoise}
            />
            <Text style={styles.modalHint}>
              {t.modalHint(100 - (parseInt(partAInput, 10) || 0))}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnAnnuler} onPress={() => setModifModalRegle(null)}>
                <Text style={styles.modalBtnAnnulerTexte}>{t.annuler}</Text>
              </Pressable>
              <Pressable style={styles.modalBtnConfirmer} onPress={confirmerModif}>
                <Text style={styles.modalBtnConfirmerTexte}>{t.confirmer}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Une clause lue dans le jugement. Rien ne s'affiche si le document est
 *  muet : un libellé suivi d'un blanc laisserait croire à une information
 *  perdue. */
function Champ({ label, valeur }: { label: string; valeur?: string }) {
  if (!valeur) return null;
  return (
    <View style={styles.champ}>
      <Text style={styles.champLabel}>{label}</Text>
      <Text style={styles.champValeur}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
  },
  // react-native-web ignore hitSlop : la zone cliquable doit être une vraie
  // marge intérieure, sinon la croix de fermeture fait 22 pixels de côté.
  zoneTactile: { padding: 10, margin: -10 },
  topbarTitre: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond },
  videWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  videTexte: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise, textAlign: 'center', lineHeight: 20 },

  progressionWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  progressionTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise, marginBottom: 6 },
  progressionBarreFond: { height: 4, borderRadius: 2, backgroundColor: COLORS.bordure },
  progressionBarreRemplie: { height: 4, borderRadius: 2, backgroundColor: COLORS.vert },

  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },

  pensionCard: {
    backgroundColor: COLORS.vertProfond, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  pensionEyebrow: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.or, letterSpacing: 0.6, marginBottom: 4 },
  pensionMontant: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.blanc },
  pensionMeta: { fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  datesCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.terracotta, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  datesEyebrow: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.terracotta, letterSpacing: 0.6, marginBottom: SPACING.sm },
  dateLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.bordure },
  dateOccasion: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },
  dateParent: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise },
  datesResultat: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vert, marginTop: SPACING.sm, lineHeight: 18 },
  datesAvertissement: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.terracotta, marginTop: 6, lineHeight: 18 },

  gardeCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.vert, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  gardeEyebrow: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.vert, letterSpacing: 0.6, marginBottom: SPACING.sm },
  gardeTexte: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.vertProfond, lineHeight: 19 },
  gardeNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, lineHeight: 17, marginTop: 6 },
  separateur: { height: 1, backgroundColor: COLORS.bordure, marginVertical: SPACING.md },

  champ: { marginBottom: SPACING.sm },
  champLabel: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.ardoise, letterSpacing: 0.3, marginBottom: 2 },
  champValeur: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.vertProfond, lineHeight: 19 },
  citation: {
    fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vertProfond, fontStyle: 'italic',
    lineHeight: 18, backgroundColor: '#F3F1EC', borderRadius: 8, padding: 10, marginTop: 2, marginBottom: SPACING.sm,
  },

  resultatOk: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  resultatOkTexte: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, lineHeight: 19 },
  resultatNon: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  resultatNonTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.terracotta },

  choixBloc: { backgroundColor: COLORS.ivoire, borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.md },
  choixTitre: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginBottom: 8, lineHeight: 17 },
  choixLigne: { flexDirection: 'row', gap: 8 },
  choixChip: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.bordure, backgroundColor: COLORS.blanc,
  },
  choixChipActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  choixChipTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
  choixChipTexteActif: { color: COLORS.blanc },

  genreSetupLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  genreSetupNom: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond },
  genreChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.bordure, backgroundColor: COLORS.blanc },
  genreChipActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  genreChipTexte: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.ardoise },
  genreChipTexteActif: { color: COLORS.blanc },

  btnGenerer: { backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center', marginTop: SPACING.md },
  btnGenererTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
  btnDesactive: { opacity: 0.4 },
  btnLien: { paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm },
  btnLienTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vert },

  regleCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
  },
  regleTitre: { fontFamily: FONTS.displaySemibold, fontSize: 16, color: COLORS.vertProfond, marginBottom: 8 },
  repartitionRow: { marginBottom: 4 },
  repartitionTexte: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise },
  repartitionValeur: { fontFamily: FONTS.bodySemibold, color: COLORS.vertProfond },
  avertissementDefaut: {
    fontFamily: FONTS.body, fontSize: 12, color: COLORS.terracotta, lineHeight: 17, marginBottom: 8, marginTop: 2,
  },
  clauseBox: { backgroundColor: '#F3F1EC', borderRadius: 8, padding: 10, marginTop: 6, marginBottom: 8 },
  clauseReference: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.ardoise, marginBottom: 3 },
  clauseExtrait: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vertProfond, fontStyle: 'italic', lineHeight: 18 },
  conditionsBox: {
    backgroundColor: 'rgba(197,160,89,0.08)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.or,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 4,
  },
  conditionsTitre: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 11.5,
    color: COLORS.vertProfond,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  conditionLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  conditionTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vertProfond, lineHeight: 17 },
  confianceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  confiancePuce: { width: 7, height: 7, borderRadius: 4 },
  confianceTexte: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm },
  btnValider: { flex: 1, backgroundColor: COLORS.vert, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  btnValiderTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.blanc },
  btnSecondaire: { flex: 1, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  btnSecondaireTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
  statutFinalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statutFinalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond },

  verdictCard: {
    backgroundColor: 'rgba(45,106,79,0.08)', borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm,
  },
  verdictTitre: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.vertProfond, marginBottom: 4 },
  verdictLigne: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vert, lineHeight: 18 },
  // La provenance des dates, sous le verdict. Même principe que l'indice
  // INSEE : un chiffre affiché sans sa source ne se vérifie pas.
  verdictSource: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise, lineHeight: 16, marginTop: 4 },

  dejaValideBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(45,106,79,0.08)',
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm,
  },
  dejaValideTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vert, lineHeight: 18 },

  btnFinaliser: {
    backgroundColor: COLORS.vert, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg,
    borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  btnFinaliserDesactive: { backgroundColor: COLORS.bordure },
  btnFinaliserTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.blanc },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  modalCard: { backgroundColor: COLORS.ivoire, borderRadius: RADIUS.lg, padding: SPACING.xl, width: '100%' },
  modalTitre: { fontFamily: FONTS.displaySemibold, fontSize: 17, color: COLORS.vertProfond, marginBottom: SPACING.md },
  modalLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise, marginBottom: 6 },
  modalInput: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 15, color: COLORS.vertProfond,
  },
  modalHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  modalBtnAnnuler: { flex: 1, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  modalBtnAnnulerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
  modalBtnConfirmer: { flex: 1, backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  modalBtnConfirmerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
});
