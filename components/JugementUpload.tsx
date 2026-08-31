// components/JugementUpload.tsx
// Écran Dualia : upload d'un jugement/convention de divorce, orchestration
// du pipeline complet (PDF -> texte -> extraction clauses), en amont de
// l'écran de validation clause par clause (/validation-cadre).
//
// Ce composant ne fait AUCUNE écriture dans le cadre familial pendant
// l'extraction elle-même : il affiche le résultat brut, et ne crée le
// CadreFamilial (statut 'a_verifier') qu'au moment où l'utilisateur choisit
// explicitement de passer à la vérification.
//
// Le résultat est présenté sous forme de "capsules" thématiques distinctes
// (garde / pension / réévaluation / divers) car ce sont des sujets
// juridiquement et fonctionnellement indépendants les uns des autres.

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { TRADUCTIONS } from '../constants/i18n';
import type { CadreFamilial, ReglePartage } from '../types';

const BACKEND_URL = 'https://dualia-backend.vercel.app';

const COLORS = {
  ivoire: '#F8F6F2',
  vertProfond: '#1C2B25',
  vert: '#2D6A4F',
  terracotta: '#B5927C',
  or: '#C9A84C',
  ardoise: '#6B7F7A',
  bleuAcier: '#4A6B8A',
};

type CapsuleProps = {
  titre: string;
  couleur: string;
  children: React.ReactNode;
};

function Capsule({ titre, couleur, children }: CapsuleProps) {
  return (
    <View style={[styles.capsule, { borderLeftColor: couleur }]}>
      <Text style={[styles.capsuleTitre, { color: couleur }]}>{titre}</Text>
      {children}
    </View>
  );
}

function LigneChamp({ label, valeur }: { label: string; valeur: string | null | undefined }) {
  if (!valeur) return null;
  return (
    <View style={styles.ligneChamp}>
      <Text style={styles.labelChamp}>{label}</Text>
      <Text style={styles.valeurChamp}>{valeur}</Text>
    </View>
  );
}

// Bandeau neutre et repliable pour les points de vigilance (OCR + incohérences).
function BandeauVerification({ items, texteLabel }: { items: string[]; texteLabel: (n: number) => string }) {
  const [ouvert, setOuvert] = useState(false);
  if (!items || items.length === 0) return null;

  return (
    <TouchableOpacity style={styles.bandeauVerif} onPress={() => setOuvert(!ouvert)} activeOpacity={0.7}>
      <Text style={styles.bandeauVerifTexte}>
        {ouvert ? '▾' : '▸'} {texteLabel(items.length)}
      </Text>
      {ouvert && (
        <View style={{ marginTop: 8 }}>
          {items.map((a, i) => (
            <Text key={i} style={styles.bandeauVerifDetail}>· {a}</Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// Traduit le résultat brut de l'extraction en CadreFamilial. Ne crée une
// règle de répartition (ReglePartage) QUE pour les frais extrascolaires,
// et uniquement avec confiance "basse" quand le pourcentage n'est pas
// explicitement écrit dans le document : Dualia ne doit jamais présenter
// un chiffre inventé comme s'il venait de la convention.
function construireCadreFamilial(resultat: any): CadreFamilial {
  const fraisExtra = resultat?.frais_extrascolaires;
  const pension = resultat?.pension_alimentaire;

  const aUnAccordDePrincipe =
    fraisExtra &&
    (fraisExtra.participation_pere_convenue === true ||
      (fraisExtra.postes_mentionnes && fraisExtra.postes_mentionnes.length > 0) ||
      fraisExtra.condition);

  const regles: ReglePartage[] = [];

  if (aUnAccordDePrincipe) {
    regles.push({
      id: `regle-${Date.now()}-activites`,
      categorie: 'activitesExtra',
      // 50/50 est une répartition standard par défaut, PAS un chiffre lu
      // dans le document — d'où confiance "basse" et l'absence de
      // clauseSource.reference. L'utilisateur doit la valider ou la modifier.
      partA: 50,
      partB: 50,
      clauseSource: {
        extrait: fraisExtra.condition || (fraisExtra.postes_mentionnes || []).join(', ') || undefined,
      },
      conditions: {
        accordPrealable: fraisExtra.participation_pere_convenue === true ? true : undefined,
      },
      detection: { confiance: 'basse', source: 'ia' },
      validation: { statut: 'a_verifier' },
    });
  }

  const periodiciteMap: Record<string, 'mensuelle' | 'trimestrielle' | 'autre'> = {
    mensuelle: 'mensuelle',
    mensuel: 'mensuelle',
    trimestrielle: 'trimestrielle',
    trimestriel: 'trimestrielle',
  };

  return {
    regles,
    pension:
      pension && pension.montant_initial_eur
        ? {
            montant: pension.montant_initial_eur,
            periodicite: periodiciteMap[String(pension.periodicite || '').toLowerCase()] ?? 'autre',
          }
        : undefined,
    documentSource: {
      id: `doc-${Date.now()}`,
      type: 'convention',
      date: resultat?.date_jugement || undefined,
    },
    statut: 'a_verifier',
  };
}

export default function JugementUpload() {
  const router = useRouter();
  const setCadreFamilial = useStore((s) => s.setCadreFamilial);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].decisions;

  const [statut, setStatut] = useState('idle'); // idle | extraction_texte | extraction_clauses | termine | erreur
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [resultat, setResultat] = useState<any>(null);

  const reinitialiser = () => {
    setStatut('idle');
    setErreur(null);
    setAvertissement(null);
    setResultat(null);
  };

  const lirePdfEnBase64 = async (asset: any): Promise<string> => {
    if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  };

  const choisirEtTraiterPdf = async () => {
    reinitialiser();

    const pick = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (pick.canceled || !pick.assets?.[0]) return;

    try {
      const pdfBase64 = await lirePdfEnBase64(pick.assets[0]);

      // Étape 1 : PDF -> texte
      setStatut('extraction_texte');
      const texteResponse = await fetch(`${BACKEND_URL}/api/extract-pdf-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      });
      const texteData = await texteResponse.json();

      if (!texteResponse.ok) {
        throw new Error(texteData.error || 'Échec extraction texte');
      }

      if (texteData.avertissement) {
        setAvertissement(texteData.avertissement);
      }

      // Étape 2 : texte -> clauses structurées
      setStatut('extraction_clauses');
      const clausesResponse = await fetch(`${BACKEND_URL}/api/extract-jugement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentText: texteData.text }),
      });
      const clausesData = await clausesResponse.json();

      if (!clausesResponse.ok) {
        throw new Error(clausesData.error || 'Échec extraction clauses');
      }

      setResultat(clausesData.extraction);
      setStatut('termine');
    } catch (err: any) {
      console.error('Erreur pipeline jugement:', err);
      setErreur(err.message);
      setStatut('erreur');
    }
  };

  const passerALaValidation = () => {
    const cadre = construireCadreFamilial(resultat);
    setCadreFamilial(cadre);
    router.push('/validation-cadre' as any);
  };

  const garde = resultat?.garde;
  const pension = resultat?.pension_alimentaire;
  const indexation = pension?.indexation;
  const fraisExtra = resultat?.frais_extrascolaires;

  const aDuDivers =
    fraisExtra &&
    (fraisExtra.participation_pere_convenue !== null ||
      (fraisExtra.postes_mentionnes && fraisExtra.postes_mentionnes.length > 0) ||
      fraisExtra.condition);

  // Fusionne l'avertissement OCR global et les avertissements d'extraction
  // dans une seule liste, pour un seul bandeau au lieu de deux blocs séparés.
  const tousLesAvertissements: string[] = [
    ...(avertissement ? [avertissement] : []),
    ...(resultat?.avertissements ?? []),
  ];

  // Nombre réel de règles de répartition qui seront créées — jamais un
  // chiffre inventé ("12 règles") tant que l'extraction ne fournit pas
  // véritablement de pourcentages structurés.
  const nbReglesDetectees = aDuDivers ? 1 : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>{t.jugementImportTitre}</Text>
      <Text style={styles.sousTitre}>{t.jugementImportSousTitre}</Text>

      {statut === 'idle' && (
        <TouchableOpacity style={styles.bouton} onPress={choisirEtTraiterPdf}>
          <Text style={styles.boutonTexte}>{t.choisirPdf}</Text>
        </TouchableOpacity>
      )}

      {(statut === 'extraction_texte' || statut === 'extraction_clauses') && (
        <View style={styles.chargement}>
          <ActivityIndicator size="large" color={COLORS.vert} />
          <Text style={styles.chargementTexte}>
            {statut === 'extraction_texte' ? t.lectureDocument : t.analyseClauses}
          </Text>
        </View>
      )}

      {statut === 'erreur' && (
        <View style={styles.encart}>
          <Text style={styles.encartErreur}>{erreur}</Text>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={reinitialiser}>
            <Text style={styles.boutonSecondaireTexte}>{t.reessayer}</Text>
          </TouchableOpacity>
        </View>
      )}

      {statut === 'termine' && resultat && (
        <View style={styles.resultat}>
          <Text style={styles.sectionTitre}>{t.typeDocumentDetecte}</Text>
          <Text style={styles.texte}>{resultat.type_document}</Text>
          <LigneChamp label={t.tribunal} valeur={resultat.tribunal} />
          <LigneChamp label={t.dateJugement} valeur={resultat.date_jugement} />

          {/* CAPSULE 1 — Mode de garde */}
          {garde && (
            <Capsule titre={t.modeGarde} couleur={COLORS.vert}>
              <LigneChamp label={t.autoriteParentale} valeur={garde.autorite_parentale} />
              <LigneChamp label={t.residencePrincipale} valeur={garde.residence_principale} />
              <LigneChamp
                label={t.droitVisiteHebergement}
                valeur={garde.droit_visite_hebergement?.description_libre}
              />
              <LigneChamp
                label={t.transportAChargeDe}
                valeur={garde.droit_visite_hebergement?.transport_a_charge_de}
              />
              <LigneChamp label={t.clausesVoyage} valeur={garde.clauses_voyage} />
              <LigneChamp label={t.confianceExtraction} valeur={garde.confiance} />
            </Capsule>
          )}

          {/* CAPSULE 2 — Pension alimentaire (montant) */}
          {pension && (
            <Capsule titre={t.pensionAlimentaire} couleur={COLORS.terracotta}>
              <LigneChamp
                label={t.montant}
                valeur={
                  pension.montant_initial_eur
                    ? `${pension.montant_initial_eur} € / ${t.periodicite.toLowerCase()}${
                        pension.par_enfant_ou_global === 'par_enfant' ? t.totalTousEnfants : ''
                      }`
                    : null
                }
              />
              <LigneChamp label={t.nombreEnfantsConcernes} valeur={String(pension.nombre_enfants_concernes ?? '')} />
              <LigneChamp label={t.periodicite} valeur={pension.periodicite} />
              <LigneChamp label={t.dureeObligation} valeur={pension.duree_obligation} />
              <LigneChamp label={t.confianceExtraction} valeur={pension.confiance} />
            </Capsule>
          )}

          {/* CAPSULE 3 — Réévaluation de la pension (indexation) */}
          {indexation && indexation.presente && (
            <Capsule titre={t.reevaluationPension} couleur={COLORS.bleuAcier}>
              <LigneChamp label={t.indiceReference} valeur={indexation.indice_reference} />
              <LigneChamp label={t.dateRevisionAnnuelle} valeur={indexation.date_revision_annuelle} />
              <LigneChamp label={t.formuleTexteSource} valeur={indexation.formule_texte_source} />
              <Text style={styles.noteCapsule}>{t.noteIndexation}</Text>
            </Capsule>
          )}

          {/* CAPSULE 4 — Divers (frais extrascolaires, etc.) */}
          {aDuDivers && (
            <Capsule titre={t.divers} couleur={COLORS.or}>
              <LigneChamp
                label={t.participationFraisExtra}
                valeur={
                  fraisExtra.participation_pere_convenue === true
                    ? t.oui
                    : fraisExtra.participation_pere_convenue === false
                    ? t.non
                    : null
                }
              />
              <LigneChamp
                label={t.postesConcernes}
                valeur={fraisExtra.postes_mentionnes?.length ? fraisExtra.postes_mentionnes.join(', ') : null}
              />
              <LigneChamp label={t.condition} valeur={fraisExtra.condition} />
            </Capsule>
          )}

          {/* Bandeau de vigilance : repliable, discret, placé après les capsules
              pour ne pas prendre le pas sur l'information principale. */}
          <BandeauVerification items={tousLesAvertissements} texteLabel={t.pointsAVerifier} />

          {/* Résumé honnête avant de passer à la vérification : jamais un
              nombre de règles inventé. */}
          <View style={styles.resumeAvantValidation}>
            <Text style={styles.resumeAvantValidationTexte}>
              {nbReglesDetectees > 0 ? t.resumeReglesTrouvees(nbReglesDetectees) : t.resumeAucuneRegle}
            </Text>
          </View>

          <TouchableOpacity style={styles.bouton} onPress={passerALaValidation}>
            <Text style={styles.boutonTexte}>{t.verifierCadre}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ivoire,
  },
  titre: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.vertProfond,
    marginBottom: 8,
  },
  sousTitre: {
    fontSize: 14,
    color: COLORS.ardoise,
    marginBottom: 24,
    lineHeight: 20,
  },
  bouton: {
    backgroundColor: COLORS.vert,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  boutonTexte: {
    color: COLORS.ivoire,
    fontWeight: '600',
    fontSize: 15,
  },
  boutonSecondaire: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  boutonSecondaireTexte: {
    color: COLORS.vert,
    fontWeight: '600',
  },
  chargement: {
    alignItems: 'center',
    marginTop: 40,
  },
  chargementTexte: {
    marginTop: 12,
    color: COLORS.ardoise,
  },
  encart: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginTop: 16,
  },
  encartErreur: {
    color: '#B3261E',
  },
  bandeauVerif: {
    backgroundColor: '#F3F1EC',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 20,
  },
  bandeauVerifTexte: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ardoise,
  },
  bandeauVerifDetail: {
    fontSize: 12,
    color: COLORS.ardoise,
    lineHeight: 18,
    marginBottom: 4,
  },
  resultat: {
    marginTop: 16,
  },
  sectionTitre: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.vertProfond,
    marginTop: 16,
    marginBottom: 4,
  },
  texte: {
    fontSize: 14,
    color: COLORS.vertProfond,
    lineHeight: 20,
  },
  capsule: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  capsuleTitre: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  ligneChamp: {
    marginBottom: 8,
  },
  labelChamp: {
    fontSize: 12,
    color: COLORS.ardoise,
    fontWeight: '600',
    marginBottom: 2,
  },
  valeurChamp: {
    fontSize: 14,
    color: COLORS.vertProfond,
    lineHeight: 19,
  },
  noteCapsule: {
    fontSize: 12,
    color: COLORS.ardoise,
    fontStyle: 'italic',
    marginTop: 4,
  },
  resumeAvantValidation: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#EEF1F0',
  },
  resumeAvantValidationTexte: {
    fontSize: 13,
    color: COLORS.vertProfond,
    lineHeight: 19,
  },
});