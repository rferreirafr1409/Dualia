// app/(tabs)/caf.tsx
//
// Ce que Dualia sait de la pension, et sa revalorisation.
//
// ---------------------------------------------------------------------------
// POURQUOI CET ÉCRAN A ÉTÉ REFAIT
// ---------------------------------------------------------------------------
//
// La version précédente était une maquette remplie de valeurs inventées,
// présentées avec l'autorité du reste de l'application :
//
//   · « ~132 €/mois — Pour 2 enfants (Emma 8 ans, Léo 5 ans) » : deux enfants
//     qui n'existent dans aucune famille, un montant sans calcul.
//   · « Attestation de garde alternée — 15 jan. 2026 » et « Déclaration
//     revenus CAF 2025 », tous deux badgés « ✓ Certifié », pour des documents
//     que Dualia n'a jamais produits.
//   · Une carte « Crédit d'impôt estimé 2025 » qui affichait en réalité le
//     montant de la pension, et « 1 840 € » codé en dur en son absence.
//   · Un simulateur dont le champ « Revenus annuels nets » n'entrait dans
//     aucun calcul : 20 000 € et 200 000 € rendaient le même résultat.
//   · « Garde alternée déclarée ✓ » affiché par défaut, quelle que soit la
//     situation réelle de la famille.
//
// Devant un magistrat, un badge « Certifié » sur un document fabriqué coûte
// la crédibilité de tout le reste — y compris de ce qui est vrai. Tout cela
// est retiré. Cet écran n'affiche plus que ce qui vient du jugement du
// parent, et dit en toutes lettres ce qu'il ne sait pas encore faire.
//
// ---------------------------------------------------------------------------
// LE CHANGEMENT DE BASE DE L'INSEE
// ---------------------------------------------------------------------------
//
// L'INSEE a changé la base de référence de l'indice des prix à la
// consommation en janvier 2026 : les valeurs publiées depuis sont en
// base 2025, celles d'avant en base 2015.
//
// Un jugement rendu avant 2026 cite donc un indice en base 2015, et la
// valeur récupérée automatiquement aujourd'hui est en base 2025. Faire le
// rapport des deux est faux, et faux dans le mauvais sens : 800 × (102,5 /
// 103,65) FAIT BAISSER la pension au lieu de la revaloriser. L'INSEE ne
// publie aucun coefficient de raccordement officiel entre les deux bases,
// seulement une table de correspondance des séries.
//
// Cet écran demande donc au parent de quelle base relève l'indice de son
// jugement, et REFUSE de calculer quand les deux bases diffèrent. Un outil
// qui rend un chiffre qu'il ne peut pas justifier ne vaut rien devant un
// juge ; un outil qui dit « je ne peux pas, et voici pourquoi » se défend.
//
// Les libellés sont définis ici plutôt que dans constants/i18n.ts : les clés
// de l'ancien écran décrivaient les données fictives, et les réutiliser
// aurait fait réapparaître « Emma » et « Léo » dans une autre langue.

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { useStore } from '../../store/useStore';
import { entetesBackend } from '../../lib/appelBackend';
import { supabase } from '../../constants/supabase';
import { formatMontant } from '../../lib/comptes';
import { BACKEND_URL } from '../../constants/environnement';

const ACCENT = '#B5927C';

type Langue = 'fr' | 'es' | 'pt' | 'en';

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

const L = {
  fr: {
    titre: 'Pension',
    sousTitre: 'Ce que dit ta décision, et sa revalorisation',

    aucunCadreTitre: 'Aucun cadre familial validé',
    aucunCadreTexte:
      "Importe ton jugement ou ta convention depuis l'onglet Décisions, puis vérifie-le. Les montants et les clauses apparaîtront ici, tels que le document les écrit.",

    pensionTitre: 'Contribution à l’entretien et à l’éducation',
    parMois: 'par mois',
    parTrimestre: 'par trimestre',
    periodiciteAutre: 'périodicité à préciser',
    parEnfant: (n: number, m: string) => `${m} par enfant · ${n} enfant${n > 1 ? 's' : ''} concerné${n > 1 ? 's' : ''}`,
    clauseSource: 'Clause du document',

    gardeTitre: 'Ce que le document dit de la garde',
    residence: 'Résidence',
    droitVisite: 'Droit de visite et d’hébergement',
    nonRenseigne: 'Non renseigné dans le document',

    revalTitre: 'Revalorisation',
    revalFormuleDefaut:
      'Pension revalorisée = montant initial × (nouvel indice ÷ indice de base).',
    revalIndiceRef: (s: string) => `Indice retenu par le document : ${s}`,
    revalDateRevision: (s: string) => `Révision : ${s}`,

    baseQuestion: 'De quelle base relève l’indice cité par ton document ?',
    baseAide:
      'Un jugement rendu avant 2026 cite un indice en base 2015. L’INSEE est passé en base 2025 en janvier 2026.',
    base2015: 'Base 2015',
    base2025: 'Base 2025',
    baseInconnue: 'Je ne sais pas',
    baseInconnueTexte:
      'Regarde la date de ton jugement : avant janvier 2026, c’est la base 2015.',

    indiceInitialLabel: 'Indice de base, celui que cite le document',
    indiceInitialPlaceholder: 'par exemple 103,61',
    enregistrer: 'Enregistrer',
    enregistre: (v: number) => `${String(v).replace('.', ',')} — enregistré`,

    indiceActuelLabel: 'Indice le plus récent',
    indiceActuelPlaceholder: 'par exemple 102,5',
    auto: (v: number, base: number | null, d: string) =>
      `Récupéré : ${String(v).replace('.', ',')}${base ? ` — base ${base}` : ''}, le ${d}`,
    recuperer: 'Récupérer la valeur du jour',
    recuperationEnCours: 'Récupération…',
    recuperationEchec:
      'La valeur n’a pas pu être récupérée. Saisis-la à la main depuis le site de l’INSEE.',
    lienInsee: 'Consulter la série sur insee.fr',

    basesDifferentesTitre: 'Calcul impossible : les deux indices ne sont pas dans la même base',
    basesDifferentesTexte:
      'Ton document cite un indice en base 2015 et la valeur récupérée est en base 2025. Leur rapport n’a pas de sens : il ferait baisser ta pension au lieu de la revaloriser. L’INSEE ne publie pas de coefficient de conversion officiel entre les deux bases. Saisis l’indice le plus récent publié dans la même base que ton jugement.',

    resultatLabel: 'Montant revalorisé',
    resultatDetail: (initial: string, ia: string, ib: string) =>
      `${initial} × (${ia} ÷ ${ib})`,
    note:
      'Ce calcul est une aide à la lecture de ta décision. Il n’a aucune valeur juridique : seul le document fait foi, et la revalorisation relève du parent débiteur.',

    pasEncoreTitre: 'Pas encore disponible',
    pasEncoreTexte:
      'Le calcul des aides familiales et la production d’attestations ne sont pas encore dans Dualia. Ils arriveront, et ils seront calculés à partir de ton dossier — pas estimés.',
  },

  es: {
    titre: 'Pensión',
    sousTitre: 'Lo que dice tu resolución, y su actualización',
    aucunCadreTitre: 'Ningún marco familiar validado',
    aucunCadreTexte:
      'Importa tu sentencia o convenio desde la pestaña Decisiones y verifícalo. Los importes y las cláusulas aparecerán aquí, tal como los escribe el documento.',
    pensionTitre: 'Contribución al mantenimiento y la educación',
    parMois: 'al mes',
    parTrimestre: 'al trimestre',
    periodiciteAutre: 'periodicidad por precisar',
    parEnfant: (n: number, m: string) => `${m} por hijo · ${n} hijo${n > 1 ? 's' : ''}`,
    clauseSource: 'Cláusula del documento',
    gardeTitre: 'Lo que el documento dice sobre la custodia',
    residence: 'Residencia',
    droitVisite: 'Régimen de visitas y estancias',
    nonRenseigne: 'No consta en el documento',
    revalTitre: 'Actualización',
    revalFormuleDefaut:
      'Pensión actualizada = importe inicial × (nuevo índice ÷ índice base).',
    revalIndiceRef: (s: string) => `Índice del documento: ${s}`,
    revalDateRevision: (s: string) => `Revisión: ${s}`,
    baseQuestion: '¿De qué base es el índice que cita tu documento?',
    baseAide:
      'Una resolución anterior a 2026 cita un índice en base 2015. El INSEE pasó a base 2025 en enero de 2026.',
    base2015: 'Base 2015',
    base2025: 'Base 2025',
    baseInconnue: 'No lo sé',
    baseInconnueTexte: 'Mira la fecha: antes de enero de 2026, es base 2015.',
    indiceInitialLabel: 'Índice base, el que cita el documento',
    indiceInitialPlaceholder: 'por ejemplo 103,61',
    enregistrer: 'Guardar',
    enregistre: (v: number) => `${String(v).replace('.', ',')} — guardado`,
    indiceActuelLabel: 'Índice más reciente',
    indiceActuelPlaceholder: 'por ejemplo 102,5',
    auto: (v: number, base: number | null, d: string) =>
      `Recuperado: ${String(v).replace('.', ',')}${base ? ` — base ${base}` : ''}, el ${d}`,
    recuperer: 'Recuperar el valor del día',
    recuperationEnCours: 'Recuperando…',
    recuperationEchec: 'No se pudo recuperar. Introdúcelo a mano desde el sitio del INSEE.',
    lienInsee: 'Ver la serie en insee.fr',
    basesDifferentesTitre: 'Cálculo imposible: los índices no son de la misma base',
    basesDifferentesTexte:
      'Tu documento cita un índice en base 2015 y el valor recuperado es base 2025. Su cociente no tiene sentido: haría bajar la pensión. El INSEE no publica coeficiente oficial de conversión. Introduce el índice más reciente de la misma base.',
    resultatLabel: 'Importe actualizado',
    resultatDetail: (initial: string, ia: string, ib: string) => `${initial} × (${ia} ÷ ${ib})`,
    note:
      'Este cálculo ayuda a leer tu resolución. No tiene valor jurídico: solo el documento da fe.',
    pasEncoreTitre: 'Aún no disponible',
    pasEncoreTexte:
      'El cálculo de ayudas y la emisión de certificados aún no están en Dualia. Llegarán, y se calcularán a partir de tu expediente, no estimados.',
  },

  pt: {
    titre: 'Pensão',
    sousTitre: 'O que diz a tua decisão, e a sua atualização',
    aucunCadreTitre: 'Nenhum quadro familiar validado',
    aucunCadreTexte:
      'Importa a tua sentença ou acordo no separador Decisões e verifica-o. Os montantes e as cláusulas aparecerão aqui, tal como o documento os escreve.',
    pensionTitre: 'Contribuição para o sustento e a educação',
    parMois: 'por mês',
    parTrimestre: 'por trimestre',
    periodiciteAutre: 'periodicidade por precisar',
    parEnfant: (n: number, m: string) => `${m} por filho · ${n} filho${n > 1 ? 's' : ''}`,
    clauseSource: 'Cláusula do documento',
    gardeTitre: 'O que o documento diz sobre a guarda',
    residence: 'Residência',
    droitVisite: 'Direito de visita e alojamento',
    nonRenseigne: 'Não consta no documento',
    revalTitre: 'Atualização',
    revalFormuleDefaut:
      'Pensão atualizada = montante inicial × (novo índice ÷ índice de base).',
    revalIndiceRef: (s: string) => `Índice do documento: ${s}`,
    revalDateRevision: (s: string) => `Revisão: ${s}`,
    baseQuestion: 'De que base é o índice citado pelo teu documento?',
    baseAide:
      'Uma decisão anterior a 2026 cita um índice na base 2015. O INSEE passou à base 2025 em janeiro de 2026.',
    base2015: 'Base 2015',
    base2025: 'Base 2025',
    baseInconnue: 'Não sei',
    baseInconnueTexte: 'Vê a data: antes de janeiro de 2026, é base 2015.',
    indiceInitialLabel: 'Índice de base, o que o documento cita',
    indiceInitialPlaceholder: 'por exemplo 103,61',
    enregistrer: 'Guardar',
    enregistre: (v: number) => `${String(v).replace('.', ',')} — guardado`,
    indiceActuelLabel: 'Índice mais recente',
    indiceActuelPlaceholder: 'por exemplo 102,5',
    auto: (v: number, base: number | null, d: string) =>
      `Obtido: ${String(v).replace('.', ',')}${base ? ` — base ${base}` : ''}, em ${d}`,
    recuperer: 'Obter o valor do dia',
    recuperationEnCours: 'A obter…',
    recuperationEchec: 'Não foi possível obter. Introduz à mão a partir do site do INSEE.',
    lienInsee: 'Ver a série em insee.fr',
    basesDifferentesTitre: 'Cálculo impossível: os índices não são da mesma base',
    basesDifferentesTexte:
      'O teu documento cita um índice na base 2015 e o valor obtido é base 2025. O rácio não faz sentido: faria baixar a pensão. O INSEE não publica coeficiente oficial de conversão. Introduz o índice mais recente da mesma base.',
    resultatLabel: 'Montante atualizado',
    resultatDetail: (initial: string, ia: string, ib: string) => `${initial} × (${ia} ÷ ${ib})`,
    note:
      'Este cálculo ajuda a ler a tua decisão. Não tem valor jurídico: só o documento faz fé.',
    pasEncoreTitre: 'Ainda não disponível',
    pasEncoreTexte:
      'O cálculo de apoios e a emissão de certidões ainda não existem no Dualia. Virão, e serão calculados a partir do teu processo, não estimados.',
  },

  en: {
    titre: 'Child support',
    sousTitre: 'What your order says, and its indexation',
    aucunCadreTitre: 'No validated family framework',
    aucunCadreTexte:
      'Import your judgment or agreement from the Decisions tab, then verify it. Amounts and clauses will appear here, exactly as the document writes them.',
    pensionTitre: 'Contribution to maintenance and education',
    parMois: 'per month',
    parTrimestre: 'per quarter',
    periodiciteAutre: 'frequency to be confirmed',
    parEnfant: (n: number, m: string) => `${m} per child · ${n} child${n > 1 ? 'ren' : ''}`,
    clauseSource: 'Clause from the document',
    gardeTitre: 'What the document says about custody',
    residence: 'Residence',
    droitVisite: 'Contact and staying arrangements',
    nonRenseigne: 'Not stated in the document',
    revalTitre: 'Indexation',
    revalFormuleDefaut:
      'Indexed amount = initial amount × (new index ÷ base index).',
    revalIndiceRef: (s: string) => `Index named by the document: ${s}`,
    revalDateRevision: (s: string) => `Review: ${s}`,
    baseQuestion: 'Which reference year does your document’s index use?',
    baseAide:
      'An order made before 2026 cites a 2015-base index. INSEE moved to a 2025 base in January 2026.',
    base2015: '2015 base',
    base2025: '2025 base',
    baseInconnue: 'I don’t know',
    baseInconnueTexte: 'Check the date: before January 2026, it is the 2015 base.',
    indiceInitialLabel: 'Base index, the one the document cites',
    indiceInitialPlaceholder: 'for example 103.61',
    enregistrer: 'Save',
    enregistre: (v: number) => `${v} — saved`,
    indiceActuelLabel: 'Most recent index',
    indiceActuelPlaceholder: 'for example 102.5',
    auto: (v: number, base: number | null, d: string) =>
      `Retrieved: ${v}${base ? ` — ${base} base` : ''}, on ${d}`,
    recuperer: 'Fetch today’s value',
    recuperationEnCours: 'Fetching…',
    recuperationEchec: 'Could not fetch. Enter it by hand from the INSEE site.',
    lienInsee: 'View the series on insee.fr',
    basesDifferentesTitre: 'Cannot compute: the two indices use different base years',
    basesDifferentesTexte:
      'Your document cites a 2015-base index and the retrieved value is 2025-base. Their ratio is meaningless: it would lower the amount instead of raising it. INSEE publishes no official conversion coefficient. Enter the most recent index published on the same base as your judgment.',
    resultatLabel: 'Indexed amount',
    resultatDetail: (initial: string, ia: string, ib: string) => `${initial} × (${ia} ÷ ${ib})`,
    note:
      'This calculation helps you read your order. It has no legal force: only the document governs.',
    pasEncoreTitre: 'Not available yet',
    pasEncoreTexte:
      'Benefit calculations and certificate generation are not in Dualia yet. They will be computed from your file, not estimated.',
  },
} as const;

const SERIE_INSEE = 'https://www.insee.fr/fr/statistiques/serie/001763852';

export default function CafScreen() {
  const langue = (useStore((s) => s.langue) || 'fr') as Langue;
  const t = L[langue] ?? L.fr;
  const cadreFamilial = useStore((s) => s.cadreFamilial);
  const verrouillerIndiceInitial = useStore((s) => s.verrouillerIndiceInitial);

  const localeDate =
    langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR';

  // Rien n'est affiché depuis un cadre non validé : un cadre « à vérifier »
  // contient ce qu'une extraction a cru lire, pas ce que le parent a confirmé.
  const cadreValide = cadreFamilial?.statut === 'valide' ? cadreFamilial : null;
  const pension = cadreValide?.pension;
  const garde = cadreValide?.garde;
  const indexation = pension?.indexation;

  const [indiceInitialSaisie, setIndiceInitialSaisie] = useState('');
  const [indiceActuel, setIndiceActuel] = useState('');
  const [baseJugement, setBaseJugement] = useState<2015 | 2025 | null>(null);
  const [recuperationEnCours, setRecuperationEnCours] = useState(false);
  const [recuperationErreur, setRecuperationErreur] = useState<string | null>(null);
  const [valeurAutomatique, setValeurAutomatique] = useState<{
    valeur: number;
    base: number | null;
    date: string;
  } | null>(null);

  // La base est lue en même temps que la valeur. L'ancienne version ne lisait
  // que `valeur_num` : c'est précisément l'information manquante qui rendait
  // le calcul faux sans que rien ne le signale.
  useEffect(() => {
    let vivant = true;
    supabase
      .from('parametres_globaux')
      .select('valeur_num, base, mis_a_jour_le')
      .eq('cle', 'insee_indice_actuel')
      .maybeSingle()
      .then(({ data }) => {
        if (!vivant || !data?.valeur_num) return;
        setValeurAutomatique({
          valeur: Number(data.valeur_num),
          base: data.base != null ? Number(data.base) : null,
          date: data.mis_a_jour_le,
        });
      });
    return () => {
      vivant = false;
    };
  }, []);

  const recupererIndiceActuel = async () => {
    setRecuperationEnCours(true);
    setRecuperationErreur(null);
    try {
      const reponse = await fetch(`${BACKEND_URL}/api/insee-indice`, {
        headers: await entetesBackend(),
      });
      const data = await reponse.json();
      if (!reponse.ok || !data.valeur) throw new Error(data.error || 'Reponse invalide');
      setIndiceActuel(String(data.valeur).replace('.', ','));
      if (data.base != null) {
        setValeurAutomatique((v) => ({
          valeur: Number(data.valeur),
          base: Number(data.base),
          date: v?.date ?? new Date().toISOString(),
        }));
      }
    } catch {
      setRecuperationErreur(t.recuperationEchec);
    } finally {
      setRecuperationEnCours(false);
    }
  };

  const nombre = (s: string) => {
    const v = parseFloat(String(s).replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  const indiceInitialVerrouille = indexation?.indiceInitialConfirme;
  const indiceInitialNum = indiceInitialVerrouille ?? nombre(indiceInitialSaisie);
  const indiceActuelNum = nombre(indiceActuel);

  // La valeur saisie à la main peut venir de n'importe quelle base ; on ne
  // connaît avec certitude que celle de la valeur récupérée automatiquement.
  // Le conflit n'est donc affirmé que lorsque le champ porte EXACTEMENT la
  // valeur automatique — sinon on ne sait pas, et on ne prétend pas savoir.
  const valeurActuelleEstAutomatique =
    valeurAutomatique != null &&
    indiceActuelNum != null &&
    Math.abs(indiceActuelNum - valeurAutomatique.valeur) < 1e-9;

  const basesIncompatibles =
    baseJugement != null &&
    valeurActuelleEstAutomatique &&
    valeurAutomatique?.base != null &&
    valeurAutomatique.base !== baseJugement;

  const montantRevalorise = useMemo(() => {
    if (!pension?.montant || !indiceInitialNum || !indiceActuelNum) return null;
    if (basesIncompatibles) return null;
    return Math.round((pension.montant * indiceActuelNum) / indiceInitialNum * 100) / 100;
  }, [pension?.montant, indiceInitialNum, indiceActuelNum, basesIncompatibles]);

  const libellePeriodicite =
    pension?.periodicite === 'mensuelle'
      ? t.parMois
      : pension?.periodicite === 'trimestrielle'
      ? t.parTrimestre
      : t.periodiciteAutre;

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      <LinearGradient colors={['#9E7A64', ACCENT]} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitre}>{t.titre}</Text>
          <Text style={styles.headerSous}>{t.sousTitre}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!cadreValide ? (
          <View style={styles.carte}>
            <Ionicons name="document-text-outline" size={22} color={COLORS.ardoise} />
            <Text style={styles.carteTitre}>{t.aucunCadreTitre}</Text>
            <Text style={styles.carteTexte}>{t.aucunCadreTexte}</Text>
          </View>
        ) : null}

        {pension?.montant ? (
          <View style={styles.carte}>
            <Text style={styles.eyebrow}>{t.pensionTitre}</Text>
            <Text style={styles.montant}>{formatMontant(pension.montant, langue)}</Text>
            <Text style={styles.montantMeta}>{libellePeriodicite}</Text>

            {pension.montantParEnfant && pension.nombreEnfantsConcernes ? (
              <Text style={styles.montantMeta}>
                {t.parEnfant(
                  pension.nombreEnfantsConcernes,
                  formatMontant(pension.montantParEnfant, langue)
                )}
              </Text>
            ) : null}

            {pension.clauseSource?.extrait ? (
              <>
                <Text style={styles.label}>{t.clauseSource}</Text>
                <Text style={styles.citation}>« {pension.clauseSource.extrait} »</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {garde ? (
          <View style={styles.carte}>
            <Text style={styles.eyebrow}>{t.gardeTitre}</Text>

            <Text style={styles.label}>{t.residence}</Text>
            <Text style={styles.valeur}>{garde.residencePrincipale || t.nonRenseigne}</Text>

            <Text style={styles.label}>{t.droitVisite}</Text>
            <Text style={styles.valeur}>
              {garde.droitVisiteHebergementDescription || t.nonRenseigne}
            </Text>
          </View>
        ) : null}

        {pension?.montant ? (
          <View style={styles.carte}>
            <Text style={styles.eyebrow}>{t.revalTitre}</Text>

            <Text style={styles.formule}>
              {indexation?.formuleTexteSource
                ? `« ${indexation.formuleTexteSource} »`
                : t.revalFormuleDefaut}
            </Text>

            {indexation?.indiceReference ? (
              <Text style={styles.meta}>{t.revalIndiceRef(indexation.indiceReference)}</Text>
            ) : null}
            {indexation?.dateRevisionAnnuelle ? (
              <Text style={styles.meta}>{t.revalDateRevision(indexation.dateRevisionAnnuelle)}</Text>
            ) : null}

            <View style={styles.separateur} />

            <Text style={styles.label}>{t.baseQuestion}</Text>
            <Text style={styles.aide}>{t.baseAide}</Text>
            <View style={styles.choixRangee}>
              <TouchableOpacity
                style={[styles.choix, baseJugement === 2015 && styles.choixActif]}
                onPress={() => setBaseJugement(2015)}
              >
                <Text style={[styles.choixTexte, baseJugement === 2015 && styles.choixTexteActif]}>
                  {t.base2015}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choix, baseJugement === 2025 && styles.choixActif]}
                onPress={() => setBaseJugement(2025)}
              >
                <Text style={[styles.choixTexte, baseJugement === 2025 && styles.choixTexteActif]}>
                  {t.base2025}
                </Text>
              </TouchableOpacity>
            </View>
            {baseJugement === null ? <Text style={styles.aide}>{t.baseInconnueTexte}</Text> : null}

            <View style={styles.separateur} />

            <Text style={styles.label}>{t.indiceInitialLabel}</Text>
            {indiceInitialVerrouille ? (
              <View style={styles.verrou}>
                <Ionicons name="lock-closed" size={13} color={COLORS.ardoise} />
                <Text style={styles.verrouTexte}>{t.enregistre(indiceInitialVerrouille)}</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={indiceInitialSaisie}
                  onChangeText={setIndiceInitialSaisie}
                  placeholder={t.indiceInitialPlaceholder}
                  placeholderTextColor={COLORS.ardoise}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.btn, !nombre(indiceInitialSaisie) && styles.btnDesactive]}
                  disabled={!nombre(indiceInitialSaisie)}
                  onPress={() => {
                    const v = nombre(indiceInitialSaisie);
                    if (v) verrouillerIndiceInitial(v);
                  }}
                >
                  <Text style={styles.btnTexte}>{t.enregistrer}</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.label}>{t.indiceActuelLabel}</Text>
            {valeurAutomatique && !indiceActuel ? (
              <TouchableOpacity
                style={styles.autoBloc}
                onPress={() => setIndiceActuel(String(valeurAutomatique.valeur).replace('.', ','))}
              >
                <Ionicons name="sync-outline" size={14} color={COLORS.vert} />
                <Text style={styles.autoTexte}>
                  {t.auto(
                    valeurAutomatique.valeur,
                    valeurAutomatique.base,
                    new Date(valeurAutomatique.date).toLocaleDateString(localeDate)
                  )}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TextInput
              style={styles.input}
              value={indiceActuel}
              onChangeText={setIndiceActuel}
              placeholder={t.indiceActuelPlaceholder}
              placeholderTextColor={COLORS.ardoise}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.btnSecondaire}
              onPress={recupererIndiceActuel}
              disabled={recuperationEnCours}
            >
              <Text style={styles.btnSecondaireTexte}>
                {recuperationEnCours ? t.recuperationEnCours : t.recuperer}
              </Text>
            </TouchableOpacity>
            {recuperationErreur ? <Text style={styles.erreur}>{recuperationErreur}</Text> : null}

            <Text style={styles.lien} onPress={() => Linking.openURL(SERIE_INSEE)}>
              {t.lienInsee}
            </Text>

            {basesIncompatibles ? (
              <View style={styles.alerte}>
                <Text style={styles.alerteTitre}>{t.basesDifferentesTitre}</Text>
                <Text style={styles.alerteTexte}>{t.basesDifferentesTexte}</Text>
              </View>
            ) : null}

            {montantRevalorise != null && indiceInitialNum && indiceActuelNum ? (
              <View style={styles.resultat}>
                <Text style={styles.resultatLabel}>{t.resultatLabel}</Text>
                <Text style={styles.resultatValeur}>
                  {formatMontant(montantRevalorise, langue)}
                </Text>
                <Text style={styles.resultatMeta}>{libellePeriodicite}</Text>
                <Text style={styles.resultatDetail}>
                  {t.resultatDetail(
                    formatMontant(pension.montant, langue),
                    String(indiceActuelNum).replace('.', ','),
                    String(indiceInitialNum).replace('.', ',')
                  )}
                </Text>
              </View>
            ) : null}

            <Text style={styles.note}>{t.note}</Text>
          </View>
        ) : null}

        <View style={styles.carteSobre}>
          <Text style={styles.carteTitreSobre}>{t.pasEncoreTitre}</Text>
          <Text style={styles.carteTexte}>{t.pasEncoreTexte}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  headerTitre: { fontSize: TYPOGRAPHY.xl, fontWeight: TYPOGRAPHY.bold, color: COLORS.blanc },
  headerSous: { fontSize: TYPOGRAPHY.sm, color: 'rgba(255,255,255,0.75)', marginTop: SPACING.xs },

  scroll: { flex: 1, marginTop: -SPACING.lg },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },

  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  carteSobre: {
    backgroundColor: COLORS.ivoireFonce,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  carteTitre: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
    marginTop: SPACING.sm,
  },
  carteTitreSobre: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
    marginBottom: SPACING.xs,
  },
  carteTexte: { fontSize: TYPOGRAPHY.sm, color: COLORS.texteMuted, lineHeight: 20, marginTop: SPACING.xs },

  eyebrow: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
  },
  montant: { fontSize: TYPOGRAPHY.titre, fontWeight: TYPOGRAPHY.bold, color: COLORS.texte },
  montantMeta: { fontSize: TYPOGRAPHY.sm, color: COLORS.texteMuted, marginTop: SPACING.xs },

  label: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  valeur: { fontSize: TYPOGRAPHY.md, color: COLORS.texte, lineHeight: 22 },
  citation: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texteMuted,
    fontStyle: 'italic',
    lineHeight: 20,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.bordure,
    paddingLeft: SPACING.md,
  },

  formule: { fontSize: TYPOGRAPHY.sm, color: COLORS.texte, lineHeight: 20 },
  meta: { fontSize: TYPOGRAPHY.xs, color: COLORS.texteMuted, marginTop: SPACING.xs },
  aide: { fontSize: TYPOGRAPHY.xs, color: COLORS.texteMuted, lineHeight: 18, marginTop: SPACING.xs },

  separateur: { height: 1, backgroundColor: COLORS.bordure, marginTop: SPACING.lg },

  choixRangee: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  choix: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    alignItems: 'center',
  },
  choixActif: { borderColor: COLORS.vert, backgroundColor: '#E8F3ED' },
  choixTexte: { fontSize: TYPOGRAPHY.sm, color: COLORS.texte },
  choixTexteActif: { color: COLORS.vert, fontWeight: TYPOGRAPHY.semibold },

  input: {
    borderWidth: 1,
    borderColor: COLORS.bordure,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.md,
    color: COLORS.texte,
    backgroundColor: COLORS.blanc,
  },
  btn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.vert,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnDesactive: { backgroundColor: COLORS.bordure },
  btnTexte: { color: COLORS.blanc, fontWeight: TYPOGRAPHY.semibold, fontSize: TYPOGRAPHY.sm },
  btnSecondaire: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.vert,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  btnSecondaireTexte: { color: COLORS.vert, fontWeight: TYPOGRAPHY.semibold, fontSize: TYPOGRAPHY.sm },

  verrou: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  verrouTexte: { fontSize: TYPOGRAPHY.md, color: COLORS.texte },

  autoBloc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  autoTexte: { fontSize: TYPOGRAPHY.sm, color: COLORS.vert, flex: 1 },

  erreur: { fontSize: TYPOGRAPHY.sm, color: COLORS.erreur, marginTop: SPACING.sm },
  lien: {
    fontSize: TYPOGRAPHY.sm,
    color: ACCENT,
    textDecorationLine: 'underline',
    marginTop: SPACING.md,
  },

  alerte: {
    marginTop: SPACING.lg,
    backgroundColor: '#FDF3E7',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.avertissement,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
  },
  alerteTitre: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.avertissement,
    marginBottom: SPACING.xs,
  },
  alerteTexte: { fontSize: TYPOGRAPHY.sm, color: COLORS.texte, lineHeight: 20 },

  resultat: {
    marginTop: SPACING.lg,
    backgroundColor: '#E8F3ED',
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
  },
  resultatLabel: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.vert,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  resultatValeur: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.vertFonce,
    marginTop: SPACING.xs,
  },
  resultatMeta: { fontSize: TYPOGRAPHY.sm, color: COLORS.vert },
  resultatDetail: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: SPACING.sm },

  note: { fontSize: TYPOGRAPHY.xs, color: COLORS.texteMuted, lineHeight: 18, marginTop: SPACING.lg },
});
