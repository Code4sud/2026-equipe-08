/**
 * Cas annotés à la main pour le banc « métiers proposés » (npm run bench:jobs).
 *
 * Chaque cas = ce que le jeune a DÉJÀ fait (1 ou 2 cartes) et les métiers qu'un
 * humain jugerait évidents. `expect` est une regex sur l'intitulé ROME : le cas
 * est réussi si AU MOINS UN métier qui la vérifie sort dans les candidats.
 *
 * - `cards` : ids de cartes de la banque (content/cards.ts) ;
 * - `texts` : cartes « générées », écrites comme le LLM les écrit, avec leurs
 *   centres d'intérêt. Ce sont les cas les plus durs : peu de mots en commun
 *   avec la fiche métier (« rustine » ≠ « cycles »).
 *
 * Ajouter un cas = ajouter une ligne. Ne mettre que des métiers présents dans
 * data/rome/jobs-index.json (accessibles sans Bac+3).
 */

export type GeneratedText = { text: string; centers: Record<string, number> };
export type BenchCase = {
  name: string;
  cards?: string[];
  texts?: GeneratedText[];
  expect: RegExp;
};

const g = (text: string, centers: Record<string, number>): GeneratedText => ({ text, centers });

export const CASES: BenchCase[] = [
  // --- Cartes de la banque, une seule ---------------------------------------
  { name: "vélo", cards: ["reparer-velo"], expect: /cycles/i },
  { name: "scooter", cards: ["reparer-scooter"], expect: /motocycles|moto|deux-roues/i },
  { name: "meuble", cards: ["monter-meuble"], expect: /agencement|Menuisier/i },
  { name: "peindre un mur", cards: ["peindre-mur"], expect: /Peintre/i },
  { name: "réparer un PC", cards: ["reparer-pc"], expect: /reconditionnement numérique|support technique informatique|Réparateur.*multimédia|exploitation informatique/i },
  { name: "installer une box", cards: ["installer-reseau"], expect: /fibre|réseaux|télécommunication|support technique/i },
  { name: "drone", cards: ["drone"], expect: /drone/i },
  { name: "montage vidéo", cards: ["montage-video"], expect: /Monteur \/ Monteuse vidéo|audiovisuel/i },
  { name: "photo", cards: ["photo"], expect: /Photographe/i },
  { name: "musique", cards: ["musique"], expect: /Musicien/i },
  { name: "dessin", cards: ["dessiner-perso"], expect: /illustrat|Dessinat/i },
  { name: "théâtre", cards: ["theatre"], expect: /Comédien/i },
  { name: "accueil événement", cards: ["accueillir-evenement"], expect: /accueil/i },
  { name: "animer un atelier", cards: ["animer-soiree"], expect: /Animat/i },
  { name: "Vinted", cards: ["vendre-vinted"], expect: /Vendeu|vente/i },
  { name: "tenir une boutique", cards: ["tenir-boutique"], expect: /Vendeu|rayon|caisse|commerce/i },
  { name: "caisse d'asso", cards: ["caisse-asso"], expect: /caiss/i },
  { name: "entraîner une équipe", cards: ["entrainer-equipe"], expect: /sporti|sport/i },
  { name: "potager", cards: ["potager"], expect: /Maraîch|Horticult|Jardinier/i },
  { name: "jardin", cards: ["jardin"], expect: /Jardinier|espaces verts/i },
  { name: "refuge animaux", cards: ["refuge"], expect: /animalier|vétérinaire|Animalier|animalerie/i },
  { name: "promener des chiens", cards: ["promener-chiens"], expect: /animal|Toilett|Dresseur|Comportementaliste/i },
  { name: "soigner un animal", cards: ["soigner-animal"], expect: /vétérinaire|Soigneur animalier/i },
  { name: "garder des enfants", cards: ["baby-sitting"], expect: /Garde d'enfant|petite enfance|auprès d'enfants/i },
  { name: "personne âgée", cards: ["aider-personne-agee"], expect: /Aide-soignant|Accompagnant Educatif|vie sociale|domicile/i },
  { name: "écouter quelqu'un", cards: ["ecouter-quelquun"], expect: /Ecoutant|Médiateur|accueil social/i },
  { name: "premiers secours", cards: ["secourisme"], expect: /Secouriste|Ambulanc|Pompier/i },
  { name: "intervenir en urgence", cards: ["pompier"], expect: /Pompier|sécurité civile|Secouriste/i },
  { name: "sécurité festival", cards: ["securite-festival"], expect: /sécurité événementielle|prévention et de sécurité/i },
  { name: "cuisiner pour plusieurs", cards: ["cuisiner-famille"], expect: /Cuisinier|Commis|restauration collective/i },
  { name: "gâteau", cards: ["gateau"], expect: /Pâtissier|Boulanger/i },
  { name: "conduire un camion", cards: ["conduire-camion"], expect: /poids lourd|engins|livreu/i },
  { name: "faire visiter", cards: ["guide-musee"], expect: /Guide|accueil touristique/i },
  { name: "démarche administrative", cards: ["aider-service-public"], expect: /accueil|Médiateur|Secrétaire/i },
  { name: "nettoyage de plage", cards: ["nettoyage-plage"], expect: /propreté|Garde nature|déchets|rivière/i },

  // --- Deux cartes --------------------------------------------------------
  { name: "vélo + Vinted", cards: ["reparer-velo", "vendre-vinted"], expect: /cycles/i },
  { name: "caisse + boutique", cards: ["caisse-asso", "tenir-boutique"], expect: /caiss|Vendeu|rayon/i },
  { name: "enfants + atelier", cards: ["baby-sitting", "atelier-enfants"], expect: /enfan|Animat/i },

  // --- Cartes « générées » : vocabulaire du quotidien, pas celui des fiches
  { name: "rustine", texts: [g("Poser une rustine sur une chambre à air", { manual: 0.8 })], expect: /cycles/i },
  { name: "chaîne de vélo", texts: [g("Remettre la chaîne d'un vélo qui a sauté", { manual: 0.8 })], expect: /cycles/i },
  { name: "écran de téléphone", texts: [g("Changer l'écran cassé d'un téléphone", { manual: 0.5, tech: 0.5 })], expect: /télécommunication|reconditionnement/i },
  { name: "couper les cheveux", texts: [g("Couper les cheveux d'un pote", { manual: 0.5, art: 0.3, care: 0.2 })], expect: /Coiff/i },
  { name: "servir à un mariage", texts: [g("Servir les plats à un mariage", { contact: 0.7, cooking: 0.3 })], expect: /Serveur|restauration/i },
  { name: "ranger une réserve", texts: [g("Ranger les cartons dans la réserve d'une épicerie", { organize: 0.6, manual: 0.4 })], expect: /Magasinier|logistique|rayon/i },
  { name: "prise électrique", texts: [g("Changer une prise électrique", { manual: 0.8, tech: 0.2 })], expect: /Electricien/i },
  { name: "évier bouché", texts: [g("Déboucher un évier", { manual: 0.9 })], expect: /Plombier/i },
  { name: "tondre", texts: [g("Tondre la pelouse et tailler une haie", { nature: 0.7, manual: 0.3 })], expect: /Jardinier|espaces verts/i },
  { name: "livrer des colis", texts: [g("Livrer des colis à scooter", { drive: 0.8, physical: 0.2 })], expect: /livreu|Coursier|taxi moto/i },
];
