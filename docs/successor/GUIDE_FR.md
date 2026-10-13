# Créer et conserver votre SUCCESSOR Ω

Le [Créateur](https://montrealai.github.io/AGIJobManager/fr/successor/) prépare un rapport de données publiques ou un site simple dans votre navigateur. Le parcours local est gratuit, sans compte, portefeuille, installation ni clé de fournisseur. Les deux outils exécutent du code déterministe vérifié; ils ne réalisent pas toutes les tâches décrites en langage naturel.

## Essayez un premier résultat

1. Choisissez l’analyse de données, puis **Essayer un exemple**. Le nom de votre système est facultatif. Vérifiez les données et lancez la création.
2. Examinez le rapport et les vérifications. Téléchargez les fichiers HTML et JSON. Conservez cette version si elle vous convient.
3. Certains identifiants de l’exemple se répètent. La première version compte correctement chaque ligne. Essayez l’amélioration qui compte une seule fois les répétitions identiques. Des valeurs contradictoires pour le même identifiant sont refusées.
4. Comparez les résultats avant de choisir la nouvelle version. Une égalité ou une régression conserve la version actuelle. Vous pouvez aussi arrêter ou revenir à la version précédente.
5. Téléchargez votre Ω et sa capsule JSON. Ouvrez le fichier HTML téléchargé dans un navigateur de bureau récent. Examinez l’aperçu de restauration, confirmez, vérifiez les données, puis relancez. Enregistrez un nouveau téléchargement après chaque modification à conserver.

Essayez ensuite le site accessible. Modifiez le titre, l’introduction et les sections. L’amélioration ajoute des liens vers chaque section. Le fichier `index.html` est modifiable. L’aperçu est isolé et ne dispose d’aucune permission de script, de réseau ou d’envoi de formulaire. Les vérifications automatiques ne constituent pas une certification d’accessibilité.

Pour vos données, utilisez un CSV avec les colonnes exactes `id,category,value`, ou un tableau JSON d’objets contenant ces trois champs. En JSON, écrivez les valeurs décimales entre guillemets. Six décimales au maximum; 1 000 lignes et 120 Ko au maximum. Fournissez uniquement des données publiques, autorisées et non personnelles. Les filtres ne peuvent pas reconnaître tous les secrets.

Une mission personnalisée peut préciser l’objectif, les sources, les droits, les outils, les résultats et les critères. Vous pouvez la conserver et préparer une demande. Son exécution reste indisponible tant qu’un environnement adapté n’est pas validé. Changer la langue de l’interface ne traduit pas votre texte.

## Conserver, restaurer et corriger

L’enregistrement dans ce navigateur est facultatif. Ce n’est pas un coffre-fort ni une sauvegarde durable. Conservez une copie téléchargée. La restauration valide le fichier, affiche son contenu, puis demande une confirmation. Elle ne lance aucun code importé et ne réactive aucune permission historique.

Le ZIP des sources comprend la licence MIT, les tests et les instructions. Avec Node 22.23.2 ou ultérieur, sans installation npm : `node --test scripts/successor/portable.test.mjs`, puis `node scripts/successor/build.mjs --out rebuilt`. Ouvrez le nouveau HTML et importez votre capsule séparée.

Si le stockage est interdit, utilisez les téléchargements. Si un téléchargement est bloqué, autorisez ce fichier ou imprimez le résumé; un résumé imprimé n’est pas un système exécutable. Sans JavaScript, les explications restent lisibles mais les outils ne s’exécutent pas. Les applications mobiles d’aperçu ne savent pas toutes exécuter un fichier HTML. Les parcours automatiques sont testés sur Chromium; les sessions avec de vrais utilisateurs et technologies d’assistance restent à réaliser.

## Demande facultative en USDC

Une amélioration locale ne coûte rien. Une demande AGI Jobs est un brouillon non financé, avec un budget hypothétique explicite en USDC, distinct des dollars canadiens et des frais ETH. Pour l’exemple de 100 USDC avec 8 % partagés entre les évaluateurs : 8 vont à l’ensemble des évaluateurs, 30 et 10 aux deux destinataires, et 52 à l’Agent. Sans évaluateur, la branche d’acceptation par l’acheteur attribue 60 à l’Agent. Les dépenses non chiffrées restent inconnues.

Examinez le brouillon exact avant de le copier dans la console avancée. Un brouillon déjà présent doit être téléchargé avant son remplacement. Dans la console, utilisez **Load saved draft**. Publier les données, vérifier le déploiement et autoriser chaque transaction sont des étapes distinctes. Le Créateur ne paie personne, ne réserve aucun exécutant et n’ouvre pas les travaux payants. La suspension opérationnelle A1–A5 reste en vigueur.

Vous gardez vos fichiers selon leurs licences. Une empreinte confirme la cohérence des octets par rapport à une copie conservée; elle ne prouve pas une revue indépendante. Revenir à une version précédente n’annule pas des paiements ou publications externes. [Détails et preuves techniques](ACCEPTANCE.md).
