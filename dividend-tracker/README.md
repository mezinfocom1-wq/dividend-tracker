# 📈 Dividend Tracker Pro

Application moderne, réactive et sécurisée pour suivre vos dividendes, vos achats d'actions et projeter vos rentes passives.

Directement inspirée de votre tableau de bord financier (Excel / Google Sheets), elle élimine le besoin de formules manuelles complexes tout en offrant une interface interactive et dynamique.

---

## 🚀 Comment lancer l'application ?

Vous avez **deux méthodes ultra simples** :
1. **Double-cliquez** sur le fichier [`launch.bat`](file:///C:/Users/OTHMANE.ISMAILI/.gemini/antigravity/scratch/dividend-tracker/launch.bat)
2. Ou ouvrez directement [`index.html`](file:///C:/Users/OTHMANE.ISMAILI/.gemini/antigravity/scratch/dividend-tracker/index.html) dans n'importe quel navigateur (Google Chrome, Microsoft Edge, Firefox, Brave).

> **Aucune installation de Node.js, Python ou serveur web n'est requise.** L'application fonctionne 100% hors-ligne dans votre navigateur.

---

## ✨ Fonctionnalités Incluses

### 1. Tableau "Positions & Income"
- **Société & Ticker** : identification rapide de chaque ligne d'action.
- **Actions** : nombre de parts détenues.
- **Investi** : total du capital engagé sur la ligne.
- **Yield on Cost (YoC %)** : calculé en temps réel selon la formule `(DPA × Actions / Investi) × 100`.
- **DPA (Dividende Par Action)** : dividende annuel distribué par titre.
- **Revenu Annuel** : estimation brute annuelle `(Actions × DPA)`.
- **Reçu** : montant des dividendes effectivement encaissés cette année sur votre compte.
- **À recevoir** : montant résiduel attendu d'ici la fin de l'année `(Revenu Annuel - Reçu)`.

### 2. Achat d'actions (Renforcement de position)
- Cliquez sur le bouton bleu **"Acheter Actions"** ou sur l'icône de caddie <i class="fa-solid fa-cart-plus"></i> de n'importe quelle ligne.
- Indiquez le nombre d'actions achetées et le cours unitaire (avec frais optionnels).
- Le nombre total d'actions et le montant investi sont **automatiquement augmentés**, et votre **Yield on Cost est immédiatement recalculé**.

### 3. Encaisser un Dividende (Suivi des versements réels)
- Cliquez sur **"Encaisser Dividende"** ou sur l'icône <i class="fa-solid fa-hand-holding-dollar"></i>.
- Saisissez la date et la somme nette/brute créditée sur votre compte bancaire.
- La colonne **« Reçu »** augmente et la colonne **« À recevoir »** diminue instantanément.
- Un journal complet de l'historique des encaissements est consultable et modifiable en bas de page.

### 4. Analyses de Concentration & Graphiques
- **Dividende annuel par position** : graphique en barres interactif avec le montant apporté par chaque titre.
- **Concentration de l'investissement** : camembert (donut) montrant la répartition de votre capital par ligne.
- **Statistiques clés** : part du Top 3 Payers, première position (Largest single pay), rendement moyen global.

### 5. Simulateur de Projection (5 / 10 / 20 ans)
- Ajustez en direct avec des curseurs :
  - **Ajout chaque mois** (€ d'épargne investie)
  - **Yield nouvel argent** (% de rendement estimé sur les nouveaux achats)
  - **Croissance dividende** (% d'augmentation organique des dividendes)
  - **Option Réinvestir (DRIP)** pour visualiser l'effet boule de neige des intérêts composés.
- Tableau et courbe graphique dynamique sur 20 ans.

### 6. Sauvegarde & Confidentialité
- Vos données sont stockées localement dans votre navigateur (`localStorage`).
- Bouton menu en haut à droite :
  - **Sauvegarder (Export JSON)** pour garder une copie de secours sur votre disque.
  - **Restaurer (Import JSON)** pour recharger vos données à tout moment ou sur un autre ordinateur.
  - **Exporter en CSV (Excel)** pour réutiliser les données dans votre tableur.
