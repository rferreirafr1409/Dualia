// app/(tabs)/decisions.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../store/useStore';
import { alerter } from '../../lib/dialogue';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { ShieldIcon, ExportIcon } from '../../components/icons';
import { StatutDecision } from '../../types';
import { TRADUCTIONS } from '../../constants/i18n';
import JugementUpload from '../../components/JugementUpload';
import { formatMontant } from '../../lib/comptes';

// Voir DUA-065 : l'export PDF n'existe pas encore.
const EXPORT_PDF_DISPONIBLE = false;

// Libellés portés par l'écran, dans les quatre langues.
//
// Pourquoi ici et pas dans constants/i18n.ts : le bloc `decisions` y est
// déjà renseigné pour les quatre langues et il titre l'écran « À traiter ».
// Or la barre latérale du bureau (TAB_LABELS dans app/(tabs)/_layout.tsx)
// nomme déjà cet écran « Décisions » : le titre et l'élément de navigation
// qui y mène se contredisaient. On aligne le titre sur la navigation, sans
// toucher 2 800 lignes d'i18n à la veille d'un déplacement.
const L = {
  fr: {
    titre: 'Décisions',
    sousTitre: 'La décision qui vous encadre, et les accords que vous prenez.',
    sectionFondatrice: 'Décision fondatrice',
    sectionAccords: 'Vos accords',
    natureJugement: 'Jugement',
    natureConvention: 'Convention',
    rendueLe: (d: string) => `Rendue le ${d}`,
    dateInconnue: 'Date non lue dans le document',
    pension: (m: string, p: string) => `Pension : ${m} ${p}`,
    perMensuelle: 'par mois',
    perTrimestrielle: 'par trimestre',
    perAutre: 'périodicité telle qu’écrite au document',
    residence: (r: string) => `Résidence : ${r}`,
    regles: (n: number) => (n === 1 ? '1 règle de partage' : `${n} règles de partage`),
    valideLe: (d: string) => `Cadre validé le ${d}`,
    aVerifier: 'Ce cadre n’est pas encore vérifié',
    aVerifierAction: 'Reprendre la vérification',
    voirPiece: 'Voir la pièce au coffre-fort',
    reimporter: 'Remplacer par un nouveau document',
    bandeauTitre: 'Une décision encadre votre organisation ?',
    bandeauTexte:
      'Jugement, convention homologuée, ordonnance : importez-la et Dualia en relève la pension, la garde et la clause de réévaluation, avec la citation du document en regard de chaque valeur. Rien n’est publié — la pièce reste dans votre coffre-fort.',
    bandeauBtn: 'Importer une décision',
    modalTitre: 'Importer une décision',
    fermer: '✕',
  },
  es: {
    titre: 'Decisiones',
    sousTitre: 'La decisión que os enmarca, y los acuerdos que tomáis.',
    sectionFondatrice: 'Decisión fundadora',
    sectionAccords: 'Vuestros acuerdos',
    natureJugement: 'Sentencia',
    natureConvention: 'Convenio',
    rendueLe: (d: string) => `Dictada el ${d}`,
    dateInconnue: 'Fecha no leída en el documento',
    pension: (m: string, p: string) => `Pensión: ${m} ${p}`,
    perMensuelle: 'al mes',
    perTrimestrielle: 'por trimestre',
    perAutre: 'periodicidad tal como figura en el documento',
    residence: (r: string) => `Residencia: ${r}`,
    regles: (n: number) => (n === 1 ? '1 regla de reparto' : `${n} reglas de reparto`),
    valideLe: (d: string) => `Marco validado el ${d}`,
    aVerifier: 'Este marco aún no está verificado',
    aVerifierAction: 'Retomar la verificación',
    voirPiece: 'Ver el documento en la caja fuerte',
    reimporter: 'Sustituir por un nuevo documento',
    bandeauTitre: '¿Una decisión enmarca vuestra organización?',
    bandeauTexte:
      'Sentencia, convenio homologado, auto: impórtalo y Dualia extrae la pensión, la custodia y la cláusula de revisión, con la cita del documento junto a cada valor. Nada se publica — el documento permanece en vuestra caja fuerte.',
    bandeauBtn: 'Importar una decisión',
    modalTitre: 'Importar una decisión',
    fermer: '✕',
  },
  pt: {
    titre: 'Decisões',
    sousTitre: 'A decisão que vos enquadra, e os acordos que tomam.',
    sectionFondatrice: 'Decisão fundadora',
    sectionAccords: 'Os vossos acordos',
    natureJugement: 'Sentença',
    natureConvention: 'Acordo',
    rendueLe: (d: string) => `Proferida em ${d}`,
    dateInconnue: 'Data não lida no documento',
    pension: (m: string, p: string) => `Pensão: ${m} ${p}`,
    perMensuelle: 'por mês',
    perTrimestrielle: 'por trimestre',
    perAutre: 'periodicidade tal como consta no documento',
    residence: (r: string) => `Residência: ${r}`,
    regles: (n: number) => (n === 1 ? '1 regra de partilha' : `${n} regras de partilha`),
    valideLe: (d: string) => `Enquadramento validado em ${d}`,
    aVerifier: 'Este enquadramento ainda não foi verificado',
    aVerifierAction: 'Retomar a verificação',
    voirPiece: 'Ver o documento no cofre',
    reimporter: 'Substituir por um novo documento',
    bandeauTitre: 'Uma decisão enquadra a vossa organização?',
    bandeauTexte:
      'Sentença, acordo homologado, despacho: importe-o e a Dualia extrai a pensão, a guarda e a cláusula de atualização, com a citação do documento ao lado de cada valor. Nada é publicado — o documento fica no vosso cofre.',
    bandeauBtn: 'Importar uma decisão',
    modalTitre: 'Importar uma decisão',
    fermer: '✕',
  },
  en: {
    titre: 'Decisions',
    sousTitre: 'The decision that frames you, and the agreements you make.',
    sectionFondatrice: 'Founding decision',
    sectionAccords: 'Your agreements',
    natureJugement: 'Judgment',
    natureConvention: 'Agreement',
    rendueLe: (d: string) => `Handed down on ${d}`,
    dateInconnue: 'Date not found in the document',
    pension: (m: string, p: string) => `Support: ${m} ${p}`,
    perMensuelle: 'per month',
    perTrimestrielle: 'per quarter',
    perAutre: 'frequency as written in the document',
    residence: (r: string) => `Residence: ${r}`,
    regles: (n: number) => (n === 1 ? '1 sharing rule' : `${n} sharing rules`),
    valideLe: (d: string) => `Framework confirmed on ${d}`,
    aVerifier: 'This framework has not been checked yet',
    aVerifierAction: 'Resume checking',
    voirPiece: 'View the document in the vault',
    reimporter: 'Replace with a new document',
    bandeauTitre: 'Does a decision frame your arrangements?',
    bandeauTexte:
      'Judgment, approved agreement, court order: import it and Dualia reads the support amount, the custody arrangement and the indexation clause, each shown beside the sentence it came from. Nothing is published — the document stays in your vault.',
    bandeauBtn: 'Import a decision',
    modalTitre: 'Import a decision',
    fermer: '✕',
  },
} as const;

function formatDate(isoDate: string, langue: 'fr' | 'pt' | 'es' | 'en') {
  const d = new Date(isoDate);
  return d.toLocaleDateString(
    langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR',
    { day: 'numeric', month: 'short' }
  );
}

/** Date complète, avec l'année. `formatDate` ci-dessus écrit « 12 mars » :
 *  acceptable pour une proposition de la semaine, pas pour la date d'une
 *  décision de justice, qu'un avocat lit pour savoir de quelle année elle
 *  date. Rend null si la chaîne n'est pas une date — le document ne porte
 *  pas toujours sa date, et l'écran doit le dire plutôt que d'afficher
 *  « Invalid Date ». */
function formatDateLongue(isoDate: string | undefined, langue: 'fr' | 'pt' | 'es' | 'en'): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(
    langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

function formatDateTime(isoDate: string, langue: 'fr' | 'pt' | 'es' | 'en') {
  const d = new Date(isoDate);
  const locale = langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR';
  const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${date} . ${time}`;
}

export default function DecisionsScreen() {
  const router = useRouter();
  const decisions = useStore((s) => s.decisions);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const ajouterDecision = useStore((s) => s.ajouterDecision);
  const mettreAJourDecision = useStore((s) => s.mettreAJourDecision);
  const horodaterDecision = useStore((s) => s.horodaterDecision);
  const draft = useStore((s) => s.nouvelleDecisionDraft);
  const setDraft = useStore((s) => s.setNouvelleDecisionDraft);
  const cadreFamilial = useStore((s) => s.cadreFamilial);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].decisions;
  const l = L[langue];

  // Catégories proposées pour l'ajout manuel d'une décision liée au jugement
  // de divorce. Elles reprennent les capsules affichées par JugementUpload
  // (garde, pension, réévaluation, divers) pour rester cohérent visuellement.
  const CATEGORIES_JUGEMENT = [
    { key: 'garde', label: t.categorieGarde },
    { key: 'pension', label: t.categoriePension },
    { key: 'reevaluation', label: t.categorieReevaluation },
    { key: 'divers', label: t.categorieDivers },
  ];

  const STATUS_LABEL: Record<StatutDecision, string> = {
    'proposée': t.statutPropose,
    'en_attente': t.statutAttente,
    'acceptée': t.statutAcceptee,
    'refusée': t.statutRefusee,
  };

  const STATUS_COLOR: Record<StatutDecision, string> = {
    'proposée': COLORS.terracotta,
    'en_attente': COLORS.terracotta,
    'acceptée': COLORS.vert,
    'refusée': COLORS.ardoise,
  };

  const FILTERS: { key: 'toutes' | StatutDecision; label: string }[] = [
    { key: 'toutes', label: t.filtreToutes },
    { key: 'en_attente', label: t.filtreAttente },
    { key: 'acceptée', label: t.filtreAcceptees },
    { key: 'refusée', label: t.filtreRefusees },
  ];

    const [filter, setFilter] = useState<'toutes' | StatutDecision>('en_attente');
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [jugementModalVisible, setJugementModalVisible] = useState(false);
  const [formTitre, setFormTitre] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    if (draft) {
      setFormDescription(draft);
      setFormTitre('');
      setModalVisible(true);
    }
  }, [draft]);

  const openCategoryPicker = () => {
    setCategoryModalVisible(true);
  };

  const chooseCategory = (label: string) => {
    setCategoryModalVisible(false);
    setFormTitre(`${label} — `);
    setFormDescription('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setDraft(null);
    setFormTitre('');
    setFormDescription('');
  };

  const submitDecision = () => {
    if (!formTitre.trim()) {
      alerter(t.titreRequisTitre, t.titreRequisMsg);
      return;
    }
    ajouterDecision({
      id: `d-${Date.now()}`,
      titre: formTitre.trim(),
      description: formDescription.trim(),
      dateCreation: new Date().toISOString(),
      auteurId: parentActif,
      statut: 'proposée',
    });
    closeModal();
  };

  // Renvoie vers la Messagerie pour discuter d'une décision avant de trancher,
  // plutôt que de forcer un choix binaire Accepter / Refuser.
  const discuterDecision = () => {
    router.push('/messagerie' as any);
  };

   // Le filtre "en_attente" (celui affiché par défaut) regroupe les deux
  // statuts qui signifient réellement "en attente de traitement" — sinon
  // les décisions "proposée" (comme celles créées via un message) restent
  // invisibles alors qu'elles réclament une action, comme "en_attente".
  // ---- La décision fondatrice --------------------------------------------
  //
  // Elle est rendue depuis `cadreFamilial`, et NON depuis une ligne de la
  // table `decisions`. Deux raisons, et la seconde est la plus importante :
  //
  // 1. `cadreFamilial` est une ligne unique et toujours à jour. Un parent qui
  //    réimporte son jugement ne crée donc pas une deuxième carte fondatrice.
  //
  // 2. Le type `Decision` ne sait dire que « proposée », « en attente »,
  //    « acceptée » ou « refusée ». Un jugement ne s'accepte ni ne se refuse :
  //    il s'impose. L'enregistrer comme une décision l'aurait affiché avec une
  //    pastille de statut et trois boutons — et devant un magistrat, un
  //    jugement muni d'un bouton « Refuser » est une faute.
  //
  // D'où, ici : pas de pastille, pas de bouclier, pas d'action de validation.
  const nature =
    cadreFamilial?.documentSource?.type === 'jugement' ? l.natureJugement : l.natureConvention;
  const dateDecision = formatDateLongue(cadreFamilial?.documentSource?.date, langue);
  const periodiciteTexte =
    cadreFamilial?.pension?.periodicite === 'mensuelle'
      ? l.perMensuelle
      : cadreFamilial?.pension?.periodicite === 'trimestrielle'
      ? l.perTrimestrielle
      : l.perAutre;
  const nbRegles = cadreFamilial?.regles?.length ?? 0;
  const cadreValideLe = formatDateLongue(cadreFamilial?.valideLe, langue);

  const filtered =
    filter === 'toutes'
      ? decisions
      : filter === 'en_attente'
      ? decisions.filter((d) => d.statut === 'en_attente' || d.statut === 'proposée')
      : decisions.filter((d) => d.statut === filter);

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View style={styles.topbarRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{l.titre}</Text>
            <Text style={styles.subtitle}>{l.sousTitre}</Text>
          </View>
          {/* Bouton unique. Il ouvrait auparavant un formulaire vierge
              pendant qu'un bouton flottant, masqué par la bulle de retour
              BETA, ouvrait le choix de catégorie : deux chemins pour la même
              action, dont le plus utile était le plus caché. C'est le choix
              de catégorie qui est conservé — « Divers » couvre le cas libre,
              et le titre proposé reste modifiable. */}
          <Pressable style={styles.newBtn} onPress={openCategoryPicker}>
            <Text style={styles.newBtnText}>{t.nouvelle}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {cadreFamilial ? (
          <View>
            <Text style={styles.sectionTitle}>{l.sectionFondatrice}</Text>
            <View style={styles.fondatriceCard}>
              <Text style={styles.fondatriceNature}>{nature}</Text>
              <Text style={styles.fondatriceDate}>
                {dateDecision ? l.rendueLe(dateDecision) : l.dateInconnue}
              </Text>
              {cadreFamilial.pension?.montant ? (
                <Text style={styles.fondatriceFait}>
                  {l.pension(
                    formatMontant(cadreFamilial.pension.montant, langue),
                    periodiciteTexte
                  )}
                </Text>
              ) : null}
              {cadreFamilial.garde?.residencePrincipale ? (
                <Text style={styles.fondatriceFait}>
                  {l.residence(cadreFamilial.garde.residencePrincipale)}
                </Text>
              ) : null}
              {nbRegles > 0 ? (
                <Text style={styles.fondatriceFait}>{l.regles(nbRegles)}</Text>
              ) : null}
              {cadreFamilial.statut === 'valide' && cadreValideLe ? (
                <Text style={styles.fondatriceValide}>{l.valideLe(cadreValideLe)}</Text>
              ) : null}
              {cadreFamilial.statut !== 'valide' ? (
                <Pressable
                  style={styles.fondatriceAlerte}
                  onPress={() => router.push('/validation-cadre' as any)}
                >
                  <Text style={styles.fondatriceAlerteTexte}>{l.aVerifier}</Text>
                  <Text style={styles.fondatriceAlerteAction}>{l.aVerifierAction}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.fondatricePiece}
                onPress={() => router.push('/documents' as any)}
              >
                <Text style={styles.fondatricePieceTexte}>{l.voirPiece}</Text>
              </Pressable>
              {/* Réimport.
                  Il manquait, et son absence fermait toute porte : le bandeau
                  d'import ne s'affiche que lorsqu'AUCUN cadre n'existe, et la
                  carte de Documents ne fait plus qu'un renvoi ici. Un parent
                  dont le jugement a été modifié par une nouvelle décision se
                  retrouvait donc sans aucun moyen de la déposer.
                  Discret, parce que c'est un geste rare — mais présent. */}
              <Pressable
                style={styles.fondatriceRemplacer}
                onPress={() => setJugementModalVisible(true)}
              >
                <Text style={styles.fondatriceRemplacerTexte}>{l.reimporter}</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionTitle}>{l.sectionAccords}</Text>
          </View>
        ) : (
          <View style={styles.jugementBanner}>
            <Text style={styles.jugementBannerTitre}>{l.bandeauTitre}</Text>
            <Text style={styles.jugementBannerTexte}>{l.bandeauTexte}</Text>
            <Pressable
              style={styles.jugementBannerBtn}
              onPress={() => setJugementModalVisible(true)}
            >
              <Text style={styles.jugementBannerBtnTexte}>{l.bandeauBtn}</Text>
            </Pressable>
          </View>
        )}

        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>{t.vide}</Text>
        ) : null}

        {filtered.map((decision) => {
          const needsAction = decision.statut === 'en_attente' || decision.statut === 'proposée';
          const canExport = decision.statut === 'acceptée';
          const author = parents[decision.auteurId]?.nom ?? decision.auteurId;

          return (
            <View key={decision.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[decision.statut] }]}>
                  {STATUS_LABEL[decision.statut]}
                </Text>
              </View>

              <Text style={styles.cardTitle}>{decision.titre}</Text>
              {decision.description ? (
                <Text style={styles.cardDescription}>{decision.description}</Text>
              ) : null}

              {needsAction ? (
                <View style={styles.actions}>
                  <Pressable style={[styles.btn, styles.btnAccept]} onPress={() => horodaterDecision(decision.id)}>
                    <Text style={styles.btnAcceptéext}>{t.accepter}</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnDiscuss]} onPress={discuterDecision}>
                    <Text style={styles.btnDiscussText}>{t.discuter}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.btnRefuse]}
                    onPress={() => mettreAJourDecision(decision.id, { statut: 'refusée' })}
                  >
                    <Text style={styles.btnRefuseText}>{t.refuser}</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Bouclier NEUTRE, et libellé qui dit qui date.
                  Un bouclier doré accolé à un horodatage, sur une décision
                  « Acceptée », se lit « scellé » — et un magistrat le lira
                  ainsi. Or cette date est produite par l'horloge du
                  navigateur du parent (voir horodaterDecision dans le
                  store) : aucune valeur probatoire tant qu'aucun contrat
                  avec un prestataire qualifié n'est effectif.
                  À repasser en doré le jour du jeton qualifié, et pas
                  avant. */}
              <View style={styles.cardFoot}>
                <View style={styles.sealRow}>
                  <ShieldIcon size={12} color={COLORS.ardoise} strokeWidth={2} />
                  <Text style={[styles.sealText, { color: COLORS.ardoise }]}>
                    {decision.horodatageEIDAS
                      ? `${t.enregistreLe} ${formatDateTime(decision.horodatageEIDAS, langue)}`
                      : `${t.creeLe} ${formatDate(decision.dateCreation, langue)}`}
                  </Text>
                </View>
                <Text style={styles.authorText}>{author}</Text>
              </View>

              {/* Le bouton « Exporter en PDF » n'affichait qu'un « bientôt
                  disponible ». Apple refuse les fonctions annoncées mais
                  absentes (DUA-101) : il reviendra avec l'export réel
                  (DUA-065). */}
              {canExport && EXPORT_PDF_DISPONIBLE ? (
                <Pressable
                  style={styles.exportBtn}
                  onPress={() => alerter(t.exportTitre, t.exportMsg)}
                >
                  <ExportIcon size={13} color={COLORS.vert} strokeWidth={2} />
                  <Text style={styles.exportBtnText}>{t.exporterPdf}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Import d'une décision de justice.
          La modal n'est ouverte que par le bandeau ci-dessus, qui ne
          s'affiche que lorsqu'aucun cadre familial n'existe : il n'y a donc
          jamais deux chemins visibles en même temps vers la même action. */}
      <Modal
        visible={jugementModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setJugementModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.jugementModalCard}>
            <View style={styles.jugementModalHeader}>
              <Text style={styles.modalTitle}>{l.modalTitre}</Text>
              <Pressable onPress={() => setJugementModalVisible(false)} hitSlop={12}>
                <Text style={styles.jugementModalFermer}>{l.fermer}</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <JugementUpload onTermine={() => setJugementModalVisible(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sélecteur de catégorie, ouvert par le bouton du haut */}
      <Modal visible={categoryModalVisible} animationType="fade" transparent onRequestClose={() => setCategoryModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryModalVisible(false)}>
          <View style={styles.categoryCard}>
            <Text style={styles.modalTitle}>{t.categoryModalTitre}</Text>
            <Text style={styles.modalHint}>{t.categoryModalHint}</Text>
            {CATEGORIES_JUGEMENT.map((c) => (
              <Pressable key={c.key} style={styles.categoryRow} onPress={() => chooseCategory(c.label)}>
                <Text style={styles.categoryRowText}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.modalTitre}</Text>
            {draft ? (
              <Text style={styles.modalHint}>{t.modalHint}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>{t.champTitre}</Text>
            <TextInput
              value={formTitre}
              onChangeText={setFormTitre}
              placeholder={t.placeholderTitre}
              placeholderTextColor={COLORS.ardoise}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>{t.champDescription}</Text>
            <TextInput
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder={t.placeholderDescription}
              placeholderTextColor={COLORS.ardoise}
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={closeModal}>
                <Text style={styles.modalBtnCancelText}>{t.annuler}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnSubmit]} onPress={submitDecision}>
                <Text style={styles.modalBtnSubmitText}>{t.proposer}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  topbar: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  topbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond },
  subtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: 3 },
  newBtn: { backgroundColor: COLORS.vertProfond, paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.full, flexShrink: 0 },
  newBtnText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ivoire },
  filterRow: { marginTop: SPACING.md },
  filterRowContent: { gap: SPACING.sm, paddingRight: SPACING.xl },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
  },
  filterPillActive: { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond },
  filterPillText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  filterPillTextActive: { color: COLORS.ivoire },
  content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl * 2 },
  sectionTitle: {
    fontFamily: FONTS.display, fontSize: 17, color: COLORS.vertProfond,
    marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: SPACING.xl, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.lg, padding: SPACING.lg + 1, marginTop: SPACING.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end' },
  statusText: { fontFamily: FONTS.bodySemibold, fontSize: 11 },
  cardTitle: { fontFamily: FONTS.display, fontSize: 15.5, color: COLORS.vertProfond, marginTop: 4 },
  cardDescription: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 5, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  btnAccept: { backgroundColor: COLORS.vert },
  btnAcceptéext: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.blanc },
  btnDiscuss: { borderWidth: 1, borderColor: COLORS.vertProfond },
  btnDiscussText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond },
  btnRefuse: { borderWidth: 1, borderColor: COLORS.bordure },
  btnRefuseText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  cardFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.bordure,
  },
  sealRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sealText: { fontFamily: FONTS.bodySemibold, fontSize: 10.5 },
  authorText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: SPACING.sm, paddingVertical: 8, borderRadius: 9,
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
  },
  exportBtnText: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.vert },
  categoryCard: {
    backgroundColor: COLORS.ivoire, borderRadius: RADIUS.xl,
    padding: SPACING.xl, margin: SPACING.xl, marginBottom: SPACING.xxxl,
  },
  categoryRow: {
    paddingVertical: 13, borderTopWidth: 1, borderTopColor: COLORS.bordure, marginTop: 8,
  },
  categoryRowText: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.vertProfond },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl,
  },
  modalTitle: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond },

  // La décision fondatrice. Accent vert à gauche, pas de bouclier, pas de
  // pastille de statut : l'autorité vient du document, pas d'un ornement
  // posé par Dualia. Même raisonnement que le bouclier neutre ci-dessus.
  fondatriceCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderLeftWidth: 3, borderLeftColor: COLORS.vert,
    borderRadius: RADIUS.lg, padding: SPACING.lg + 1, marginBottom: SPACING.lg,
  },
  fondatriceNature: { fontFamily: FONTS.display, fontSize: 16.5, color: COLORS.vertProfond },
  fondatriceDate: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 3, marginBottom: SPACING.md },
  fondatriceFait: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.texte, marginTop: 4, lineHeight: 19 },
  fondatriceValide: {
    fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.vert,
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.bordure,
  },
  fondatriceAlerte: {
    marginTop: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.bordure,
  },
  fondatriceAlerteTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.avertissement },
  fondatriceAlerteAction: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vert, marginTop: 4 },
  fondatricePiece: {
    marginTop: SPACING.md, paddingVertical: 9, borderRadius: 9, alignItems: 'center',
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
  },
  fondatricePieceTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vert },
  fondatriceRemplacer: { marginTop: SPACING.sm, paddingVertical: 7, alignItems: 'center' },
  fondatriceRemplacerTexte: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, textDecorationLine: 'underline' },

  jugementBanner: {
    backgroundColor: COLORS.vertProfond, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  jugementBannerTitre: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.blanc, marginBottom: 4 },
  jugementBannerTexte: { fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 18, marginBottom: SPACING.md },
  jugementBannerBtn: {
    backgroundColor: COLORS.or, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: SPACING.lg,
  },
  jugementBannerBtnTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond },
  jugementModalCard: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl, maxHeight: '92%',
  },
  jugementModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  jugementModalFermer: { fontFamily: FONTS.bodySemibold, fontSize: 18, color: COLORS.ardoise },
  modalHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.terracotta, marginTop: 4 },
  fieldLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14, color: COLORS.vertProfond,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md },
  modalBtnCancel: { borderWidth: 1, borderColor: COLORS.bordure },
  modalBtnCancelText: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
  modalBtnSubmit: { backgroundColor: COLORS.vert },
  modalBtnSubmitText: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
});