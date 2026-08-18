import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { DocumentItem, CategorieDocument } from '../../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORIES: {
  id: CategorieDocument;
  emoji: string;
  label: string;
  couleur: string;
  fond: string;
}[] = [
  { id: 'administratif', emoji: '📋', label: 'Administratif', couleur: COLORS.ardoise, fond: '#EEF1F0' },
  { id: 'sante', emoji: '🏥', label: 'Santé', couleur: COLORS.vert, fond: '#E8F3ED' },
  { id: 'ecole', emoji: '📚', label: 'École', couleur: COLORS.or, fond: '#FBF3DF' },
  { id: 'juridique', emoji: '⚖️', label: 'Juridique', couleur: COLORS.terracotta, fond: '#F7EEE9' },
];

const ACCENT = '#6B7F7A';

function getCatInfo(cat: CategorieDocument) {
  return CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0];
}

export default function DocumentsScreen() {
  const { documents, parents, parentActif, ajouterDocument } = useStore();

  const [recherche, setRecherche] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState<CategorieDocument | 'tous'>('tous');
  const [modalVisible, setModalVisible] = useState(false);
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState<CategorieDocument>('administratif');
  const [note, setNote] = useState('');

  const documentsFiltres = useMemo(() => {
    return documents.filter((doc) => {
      const matchRecherche = doc.nom
        .toLowerCase()
        .includes(recherche.toLowerCase());
      const matchCategorie =
        filtreCategorie === 'tous' || doc.categorie === filtreCategorie;
      return matchRecherche && matchCategorie;
    });
  }, [documents, recherche, filtreCategorie]);

  const documentsByCategorie = useMemo(() => {
    const grouped: Record<CategorieDocument, DocumentItem[]> = {
      administratif: [],
      sante: [],
      ecole: [],
      juridique: [],
    };
    documentsFiltres.forEach((doc) => {
      grouped[doc.categorie].push(doc);
    });
    return grouped;
  }, [documentsFiltres]);

  const soumettre = () => {
    if (!nom.trim()) return;
    const doc: DocumentItem = {
      id: `doc-${Date.now()}`,
      nom: nom.trim(),
      categorie,
      auteurId: parentActif,
      date: new Date().toISOString(),
      certifie: false,
      note: note.trim() || undefined,
    };
    ajouterDocument(doc);
    setNom('');
    setNote('');
    setCategorie('administratif');
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      {/* Header */}
      <LinearGradient colors={['#566B66', ACCENT]} style={styles.header}>
        <View>
          <Text style={styles.headerTitre}>Documents</Text>
          <Text style={styles.headerSous}>Coffre-fort numérique</Text>
        </View>
        <View style={styles.compteWrap}>
          <Text style={styles.compteTxt}>{documents.length}</Text>
          <Text style={styles.compteSous}>docs</Text>
        </View>
      </LinearGradient>

      {/* Barre de recherche */}
      <View style={styles.rechercheWrap}>
        <View style={styles.rechercheBar}>
          <Ionicons name="search-outline" size={16} color={COLORS.ardoise} />
          <TextInput
            style={styles.rechercheInput}
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Rechercher un document..."
            placeholderTextColor={COLORS.ardoise}
          />
          {recherche ? (
            <TouchableOpacity onPress={() => setRecherche('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.ardoise} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filtres catégorie */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtresScroll}
        contentContainerStyle={styles.filtresContent}
      >
        <TouchableOpacity
          style={[styles.filtreOpt, filtreCategorie === 'tous' && styles.filtreActif]}
          onPress={() => setFiltreCategorie('tous')}
        >
          <Text style={[styles.filtreTxt, filtreCategorie === 'tous' && styles.filtreTxtActif]}>
            Tous
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.filtreOpt, filtreCategorie === cat.id && styles.filtreActif]}
            onPress={() => setFiltreCategorie(cat.id)}
          >
            <Text style={styles.filtreEmoji}>{cat.emoji}</Text>
            <Text
              style={[
                styles.filtreTxt,
                filtreCategorie === cat.id && styles.filtreTxtActif,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {CATEGORIES.map((cat) => {
          const docs = documentsByCategorie[cat.id];
          if (docs.length === 0) return null;
          return (
            <View key={cat.id} style={styles.groupe}>
              <View style={styles.groupeHeader}>
                <Text style={styles.groupeEmoji}>{cat.emoji}</Text>
                <Text style={styles.groupeTitre}>{cat.label}</Text>
                <View style={[styles.groupeCount, { backgroundColor: cat.fond }]}>
                  <Text style={[styles.groupeCountTxt, { color: cat.couleur }]}>
                    {docs.length}
                  </Text>
                </View>
              </View>
              {docs.map((doc) => {
                const auteur = parents[doc.auteurId];
                return (
                  <View key={doc.id} style={styles.docCard}>
                    <View style={[styles.docIcon, { backgroundColor: cat.fond }]}>
                      <Ionicons
                        name={'document-text-outline' as IoniconName}
                        size={20}
                        color={cat.couleur}
                      />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docNom}>{doc.nom}</Text>
                      <View style={styles.docMeta}>
                        <View
                          style={[styles.auteurDot, { backgroundColor: auteur.couleur }]}
                        />
                        <Text style={styles.docMetaTxt}>{auteur.nom.split(' ')[0]}</Text>
                        <Text style={styles.docMetaTxt}>·</Text>
                        <Text style={styles.docMetaTxt}>
                          {format(parseISO(doc.date), 'd MMM yyyy', { locale: fr })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.docDroit}>
                      <View
                        style={[
                          styles.certifBadge,
                          doc.certifie ? styles.certifOk : styles.certifStd,
                        ]}
                      >
                        <Text
                          style={[
                            styles.certifTxt,
                            doc.certifie && styles.certifTxtOk,
                          ]}
                        >
                          {doc.certifie ? '✓ Certifié' : 'Standard'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {documentsFiltres.length === 0 && (
          <View style={styles.vide}>
            <Text style={styles.videEmoji}>📂</Text>
            <Text style={styles.videTxt}>Aucun document trouvé</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#566B66', ACCENT]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={22} color={COLORS.blanc} />
          <Text style={styles.fabTxt}>Ajouter un document</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <View style={styles.modalPoignee} />
            <Text style={styles.modalTitre}>Nouveau document</Text>

            <Text style={styles.label}>Nom du document</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={setNom}
              placeholder="Ex : Carnet de santé Emma"
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catOpt,
                    { backgroundColor: cat.fond },
                    categorie === cat.id && styles.catActif,
                  ]}
                  onPress={() => setCategorie(cat.id)}
                >
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[
                      styles.catLabel,
                      { color: cat.couleur },
                      categorie === cat.id && styles.catLabelActif,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Note (facultatif)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Description ou remarque..."
              placeholderTextColor={COLORS.ardoise}
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btnAnnuler}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnAnnulerTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnValider, !nom.trim() && styles.btnDisabled]}
                onPress={soumettre}
                disabled={!nom.trim()}
              >
                <Text style={styles.btnValiderTxt}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  headerTitre: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.blanc,
  },
  headerSous: {
    fontSize: TYPOGRAPHY.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.xs,
  },
  compteWrap: { alignItems: 'center' },
  compteTxt: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.blanc,
  },
  compteSous: {
    fontSize: TYPOGRAPHY.xs,
    color: 'rgba(255,255,255,0.7)',
  },

  rechercheWrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  rechercheBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  rechercheInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texte,
  },

  filtresScroll: { maxHeight: 44 },
  filtresContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    alignItems: 'center',
    paddingBottom: SPACING.sm,
  },
  filtreOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.blanc,
  },
  filtreActif: {
    backgroundColor: COLORS.vertProfond,
  },
  filtreEmoji: { fontSize: 14 },
  filtreTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    fontWeight: TYPOGRAPHY.medium,
  },
  filtreTxtActif: { color: COLORS.blanc },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg },

  groupe: { marginBottom: SPACING.xl },
  groupeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  groupeEmoji: { fontSize: 18 },
  groupeTitre: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
    flex: 1,
  },
  groupeCount: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupeCountTxt: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.bold,
  },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docInfo: { flex: 1 },
  docNom: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.texte,
    marginBottom: SPACING.xs,
  },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  auteurDot: { width: 6, height: 6, borderRadius: RADIUS.full },
  docMetaTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
  },
  docDroit: {},
  certifBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  certifOk: { backgroundColor: '#E6F4EA' },
  certifStd: { backgroundColor: COLORS.ivoireFonce },
  certifTxt: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
  },
  certifTxtOk: { color: COLORS.succes },

  vide: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  videEmoji: { fontSize: 40, marginBottom: SPACING.md },
  videTxt: {
    fontSize: TYPOGRAPHY.md,
    color: COLORS.ardoise,
  },

  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.xl,
    right: SPACING.xl,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  fabTxt: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
  },

  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modal: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  modalPoignee: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.bordure,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.xl,
  },
  modalTitre: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: COLORS.ivoireFonce,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texte,
    marginBottom: SPACING.lg,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  catOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  catActif: {
    borderWidth: 2,
    borderColor: COLORS.vertProfond,
  },
  catEmoji: { fontSize: 16 },
  catLabel: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.medium,
  },
  catLabelActif: { fontWeight: TYPOGRAPHY.semibold },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  btnAnnuler: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center',
  },
  btnAnnulerTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    fontWeight: TYPOGRAPHY.medium,
  },
  btnValider: {
    flex: 2,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnValiderTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.semibold,
  },
});
