# Prompt de mise à jour du « Kit collectif MSS BZH »

*À copier-coller dans une nouvelle conversation avec Claude, en joignant le fichier `kit-mss.zip` (le contenu actuel du dépôt GitHub). Adaptez la section « Ce que je veux cette fois » avant d'envoyer.*

---

## Le prompt

Tu vas mettre à jour le **« Kit collectif MSS BZH »**, un site statique pour les Maisons Sport-Santé (MSS) de Bretagne. Il est publié sur GitHub Pages (dépôt `oisclmanu-dev/kit-mss`, adresse https://oisclmanu-dev.github.io/kit-mss/). Le zip joint contient la version actuelle.

### Ce que je veux cette fois

- [ ] **Mise à jour complète** : revérifier toutes les informations venant d'internet (voir le tableau des sources ci-dessous).
- [ ] **Mise à jour partielle** : seulement les rubriques suivantes : [à préciser].
- [ ] **Ajouts** : [nouvelles MSS, nouveaux référents, nouveaux documents…].

### 1. Comment fonctionne l'outil (à respecter impérativement)

- **Site 100 % statique, sans PHP ni base de données ni mot de passe.** Le moteur `assets/kit.js` lit des fichiers texte avec `fetch()`. Ne modifie le moteur que si c'est indispensable, et dis-le.
- **`menu.txt`** contient les réglages du site et la section `[Menu]`, qui liste les dossiers de `rubriques/` dans l'ordre d'affichage.
- **Chaque rubrique** (`rubriques/<Dossier>/`) contient :
  - un `config.txt` (`Titre`, `Introduction`, `Filtres`, `Titre des blocs`, section `[Blocs]`, section `[Documents]` avec des lignes `Catégorie : …`) ;
  - un `page.html` pour le contenu libre.
- **Chaque bloc** est un sous-dossier avec un `config.txt` au format `Clé : valeur`. Les lignes commençant par `#` sont des commentaires. Champs reconnus :
  - `Nom`, `Statut juridique`, `Département`, `Ville`, `Adresse`, `Contact`, `Téléphone`, `Email` ;
  - `Site` (alias : `Lien`) ;
  - `Émetteur` (alias : `Organisme`) ;
  - `Description` et `Logo : logo.png`.
  Tout autre champ (`Type d'offre`, `Type de contact`, `Public`, `Durée`, `Montant`…) s'affiche aussi. Un champ placé dans `Filtres :` devient un filtre de rubrique.
- **Noms de dossiers et de fichiers sans accents** ni caractères spéciaux. Le nom affiché garde ses accents grâce à `Titre :` (rubrique) ou `Nom :` (bloc). Un nouveau bloc doit aussi être ajouté dans la section `[Blocs]` de sa rubrique, sinon il n'apparaît pas.
- **Format des départements** : `22 - Côtes-d'Armor`, `29 - Finistère`, `35 - Ille-et-Vilaine`, `56 - Morbihan`, ou `Toute la Bretagne`.
- **Le livret d'accueil** (`rubriques/Livret d'accueil/page.html`) se remplit en partie automatiquement à partir des fiches :
  - `data-auto="financements"` ;
  - `data-auto="referents"` : toutes les fiches qui ont un champ `Type de contact`, dans Partenaires et Contacts ;
  - `data-auto="mss"`, `data-auto="formations"`, `data-auto="outils-com"`.
  Il propose des filtres (département, statut juridique) et doit rester à **9 pages maximum, couverture comprise**, avec ou sans filtre.

### 2. Règles sur les informations

1. **Coordonnées** : publie un téléphone, un email ou un nom de personne uniquement s'il est visible sur une page internet publique, sauf les référents du collectif que je t'indique moi-même. En cas de doute, laisse le champ vide.
2. **Sources** : n'invente jamais une adresse internet. N'utilise que des liens réellement consultés (recherche ou page lue). Si un site refuse l'accès, ne le contourne pas : dis-le et passe à une autre source officielle.
3. **Priorité aux sources officielles** : ARS Bretagne, ac-rennes.fr, annuaire Service-Public, sports.gouv.fr, Légifrance, sites des préfectures, sites des structures elles-mêmes.
4. **Traçabilité** : dans chaque `config.txt` modifié, mets à jour la ligne de commentaire `# Source : … (relevé du JJ/MM/AAAA)`.
5. **Pas de message destiné aux administrateurs dans ce qui s'affiche** (« à compléter », « déposez vos fichiers », « modifiez le config.txt »…). Ces consignes vont dans les commentaires `#` ou dans `mode-emploi.html`.
6. **Contenus à ne pas modifier sans mon accord** : le mot du collectif, les conseils et les résultats du questionnaire (pourcentages des besoins, état des lieux des partenariats 2025). Ils viennent des travaux du collectif, pas d'internet.

### 3. Les informations à revérifier sur internet

| Rubrique / fichiers | Ce qu'il faut vérifier | Sources de départ |
|---|---|---|
| **Procedure Habilitation & extension MSS** | Appel à projets d'habilitation en cours, dates limites, procédure d'extension, cahier des charges, liens des démarches en ligne | https://www.bretagne.ars.sante.fr/appel-projets-pour-lhabilitation-de-nouvelles-maisons-sport-sante · https://www.demarches-simplifiees.fr/commencer/habilitation-maison-sport-sante · https://demarche.numerique.gouv.fr/commencer/demande-d-extension-de-territoire-d-une-mss-deja-h-2 |
| **Liste MSS collectif** (blocs) | MSS habilitées en Bretagne (nouvelles, fermées), adresses, statut juridique, téléphone et email publics | https://www.sports.gouv.fr/maisons-sport-sante (carte et liste nationales), sites des MSS. Si la liste du collectif m'est fournie en Excel, elle prime. |
| **Identification structures Sport Sante** (≈ 270 blocs) | Structures et activités de l'annuaire régional, avec leurs coordonnées publiées | https://bretagne-sport-sante.fr/trouver-une-activite/ — voir la méthode ci-dessous |
| **Partenaires** (blocs ARS, délégations, DRAJES, SDJES) | Adresses, téléphones, emails génériques | https://www.bretagne.ars.sante.fr/organisation-et-contact · https://www.ac-rennes.fr/drajes-bretagne · annuaire https://lannuaire.service-public.gouv.fr (fiches SDJES 22, 29, 35, 56 et DRAJES) |
| **Contacts** (collectif + référents du collectif par département) | **Ne pas chercher sur internet** : demande-moi les changements | — |
| **Financements** (blocs + `page.html`) | Dispositifs encore ouverts, montants, dates limites, lien précis de chaque dispositif (champ `Site`), champ `Type de financement` (Subvention / Appel à projets / Fondation) ; nouveaux appels à projets ARS, DRAJES, ANS, conférences des financeurs 22-29-35-56, fondations (dont Fondation d'entreprise Harmonie Mutuelle) ; tableau des mutuelles qui remboursent l'APA dans `page.html` | Pages « appels à projets » de https://www.bretagne.ars.sante.fr · https://lecompteasso.associations.gouv.fr/ · https://www.pourbienvieillirbretagne.fr/appel-a-projets/ · https://www.agencedusport.fr · https://www.sports.gouv.fr · listing des mutuelles d'Azur Sport Santé https://azursportsante.fr/fr/outils/id-10-listing-des-mutuelles-et-assurances |
| **Outils** (blocs) | Nouveaux outils utiles aux MSS, liens toujours valides, champ `Type d'outil` | https://azursportsante.fr/fr/outils · https://azursportsante.fr/fr/ressources |
| **Liste MSS collectif** — carte | Nouvelle édition de la carte régionale des MSS (image `carte/carte-mss-bretagne.jpg`, PDF dans `documents/`) et lignes `Carte : n° \| x % \| y %` des fiches | Carte fournie par le collectif ou l'ARS |
| **Formations** (blocs) | Sessions de l'année, tarifs, nouvelles formations sport-santé en Bretagne | https://maisonsportsante.chu-rennes.fr · https://www.sport-sante-armor.fr · https://bretagne-sport-sante.fr (articles « formation ») · https://www.defisantenutrition.fr · https://www.pssmformation.fr/devenir-secouriste/ |
| **Présentation du rôle des MSS** et **Identification…** (`page.html`) | Textes réglementaires sur l'APA (art. L. 1172-1 et D. 1172-1 et suivants du code de la santé publique), formulaire de prescription, tableau « qui peut encadrer » | Légifrance, https://www.vidal.fr/infos-sport-medicosport-sante/ |
| **Livret d'accueil** — page « Outils de communication » | Charte graphique et logo MSS (version en vigueur), carte nationale, plaquette ARS, formulaire de prescription | https://www.sports.gouv.fr/maisons-sport-sante · https://www.bretagne.ars.sante.fr |
| **Documents modeles** | Ne pas modifier les modèles Word sans demande. Vérifier seulement que chaque ligne de `[Documents]` pointe vers un fichier existant. | — |

**Méthode pour l'annuaire Bretagne Sport Santé.** La page charge les activités en JavaScript. Utilise un navigateur si tu en as un, sinon l'API publique WordPress du site (`/wp-json/wp/v2/job-listings`, avec le champ `_job_location`) et les pages de détail `/activite/<slug>/`. Une page de détail donne la catégorie (« Forme Santé » ou « Maladies Chroniques »), la structure, le mail, le site, le téléphone, le type d'activité, le profil des encadrants et les pathologies. Ensuite :
- **Regroupe les activités par structure** : un bloc par structure, nommé d'après la structure. Si aucune structure n'est indiquée, nomme le bloc « activité – commune ».
- **Type d'offre** : « Forme Santé » donne `Sport Santé`, « Maladies chroniques » donne `APA`. Une structure qui a les deux reçoit les deux valeurs.
- **Département** : tiré du code postal, ou de la commune à défaut.
- **Champs de chaque fiche** : `Activités` (une ligne `• titre — commune — catégorie` par activité), `Encadrement` (profils, sans nom de personne), `Pathologies prises en charge (APA)` et `Fiche Bretagne Sport Santé` (lien vers la fiche d'origine).
- **Mise à jour** : compare avec les fiches existantes. Ajoute, modifie ou supprime, puis mets à jour `[Blocs]` et le nombre de structures cité dans `page.html`.

### 4. Déroulé attendu

1. **Inventaire** : liste les rubriques, le nombre de blocs et les dates de relevé actuelles, puis dis-moi ce que tu vas revérifier.
2. **Vérification** rubrique par rubrique, avec un journal des changements : ce qui a changé, l'ancienne et la nouvelle valeur, la source.
3. **Mise à jour des fichiers**, en respectant les règles des sections 1 et 2.
4. **Tests** avant livraison :
   - lancer un serveur local (`python3 -m http.server`) et ouvrir chaque rubrique : aucune fiche en erreur, filtres fonctionnels ;
   - générer le livret sans filtre et avec un filtre (département et statut) : 9 pages maximum, aucun texte qui déborde ;
   - générer le kit en PDF ;
   - vérifier que tous les liens `[Documents]` locaux existent ;
   - vérifier qu'aucun nom de dossier ou de fichier ne contient d'accent.
5. **Livraison** :
   - un nouveau `kit-mss.zip`, avec les fichiers à la racine et le bit exécutable conservé sur `Lancer-en-local-Mac.command` ;
   - le journal des changements avec ses sources ;
   - la liste de ce que tu n'as pas pu vérifier, et pourquoi ;
   - les dossiers à supprimer sur GitHub, s'il y en a.

### 5. Ce qu'il ne faut pas faire

- Ajouter du PHP, une connexion par mot de passe, un service payant ou une dépendance en ligne.
- Renommer une rubrique ou un dossier sans me le signaler : un nom de dossier sert aussi d'adresse dans le site.
- Supprimer une MSS ou une structure sans source montrant qu'elle a fermé ou n'est plus référencée.
- Publier des données personnelles non publiques, ou inventer une information pour remplir un champ vide.
