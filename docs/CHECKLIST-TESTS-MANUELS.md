# Checklist tests manuels — Dragons Generator

Coche au fur et à mesure (`[x]`). Univers **Eana / Dragons**.  
Stack locale : `http://localhost:8081` (ou `ng serve` + API).

**Légende**


| Symbole | Sens                                 |
| ------- | ------------------------------------ |
| 🔴      | Bloquant / régression critique       |
| 🟠      | Important (parcours joueur fréquent) |
| 🟢      | Nice-to-have / coin sombre           |
| 👤      | Joueur                               |


---

## 0. Avant de commencer

- [x] 🔴 Stack locale UP (web + API) ou prod de test connue
- [x] 🔴 Compte de test **joueur** prêt (email confirmé)
- [x] 🟠 Second compte **ami** (pour invites / campagne) — optionnel mais recommandé
- [x] 🟢 Navigateur : Chrome ou Edge (desktop) ; un passage mobile si possible

**Notes de session**


| Date | Environnement | OK global ? | Bugs trouvés |
| ---- | ------------- | ----------- | ------------ |
|      | local / prod  | Oui / Non   |              |


---



## 1. Auth & compte ⚙️

- [x] 🔴 Inscription → mail (Mailhog en local) → confirmation email
- [x] 🔴 Connexion / déconnexion
- [x] 🟠 Mot de passe oublié → reset via lien
- [x] 🟠 Paramètres : changer pseudo / mot de passe
- [x] 🟢 Sans compte : création perso + PDF OK ; **pas** de liste Héros cloud
- [x] 🟢 Pas d’UI « importer un JSON joueur » (hors scope produit)

---



## 2. Wizard — parcours complet 👤 🔴

Créer un perso **niveau 3**, classe **lanceur** (ex. Magicien ou Prêtre), jusqu’à la sauvegarde.

### 2.1 Navigation & brouillon

- [x] 🔴 Niveau 1–20 sélectionnable ; Continuer → Espèce
- [x] 🔴 Espèce : **« ← Étape précédente »** ramène au Niveau
- [x] 🟠 Carrousel peuples : sélection, sous-espèce si besoin, Continuer
- [x] 🔴 Civilisation : confirmer une civ → avancer
- [x] 🔴 Revenir sur Civilisation après Historique : **« Continuer → »** visible (pas bloqué sur « Terre natale confirmée »)
- [x] 🟠 Historique preset : Valider → Classe
- [x] 🔴 Historique **custom** : remplir nom + privilège → Valider → plus loin → **revenir** : champs custom encore là (pas de mur de validation)
- [x] 🟠 Classe + sous-classe ; niveau plus modifiable jusqu’ici
- [x] 🟠 Caractéristiques (point-buy / ASI si niveau ≥ 4)
- [x] 🟠 Savoirs, équipement, langues (erreurs visibles si incomplet)
- [x] 🟠 Magie (si lanceur) : quotas / grimoire cohérents
- [x] 🟠 Identité : nom requis ; génération histoire IA (si clé OK) ou message d’erreur clair
- [x] 🔴 Récap : aperçu PDF (ou empty state FR) ; **vousvoiement** (pas « ton » / « viewer »)
- [x] 🔴 Sauvegarde cloud connecté → fiche / liste Héros
- [x] 🟢 Reprendre un brouillon wizard après refresh



### 2.2 Classes / sorts à fumer (régressions connues)

- [x] 🟠 **Guerrier + Élu arcanique** : **pas** de lanceur 1/3 type Eldritch Knight PHB (étape Magie absente ou sans slots PHB)
  - *Rappel : sous-classe Eana (pas EK PHB). Le test vérifie qu’on ne lui donne pas de lanceur 1/3 — ce n’est pas un perso « fun » à créer pour le plaisir.*
- [x] 🟠 Ensorceleur : métamagie / points arcaniques OK
- [x] 🟠 Paladin : serment + sorts
- [x] 🟠 Lettré / Magicien **niveaux 17–19** (si tu as le temps) : maîtrise / sorts attitrés

---



## 3. Liste Héros 👤 🟠

- [x] 🔴 Déconnecté : écran « Compte requis »
- [x] 🔴 Connecté : cartes (nom, espèce, classe, niv., PV, CA)
- [x] 🟠 Voir → fiche ; Modifier → wizard en édition
- [x] 🟠 Dupliquer → copie dans la liste
- [x] 🟠 PDF téléchargeable
- [x] 🔴 Supprimer : taper le **nom exact** ; succès cloud ; erreur si réseau KO (message visible)

---



## 4. Fiche de jeu (play view + PDF) 👤 🟠

Ouvrir un lanceur sauvegardé (idéalement Magicien / Sorcier).

- [x] 🔴 En-tête : nom, espèce, classe, niveau
- [x] 🟠 Bandeau combat : PV (temporaires en FR), CA, Init, maîtrise, perception, VD
- [x] 🟠 **Ressources de classe** : rage / ki / etc. visibles ; **pas** de doublon « cantrips connus / sorts connus » si bloc Incantation présent
- [x] 🔴 **Incantation** : caractéristique, DD, Attaque de sort, emplacements **restants**, grimoire par niveau, badge « préparé »
- [x] 🟠 Sorcier : section Magie de pacte si applicable
- [x] 🟠 Aptitudes / compétences / équipement lisibles
- [x] 🔴 Aperçu PDF + Télécharger PDF
- [x] 🟢 Empty grimoire : message « Aucun sort listé… » si perso sans sorts

---



## 5. Campagne — côté MJ 🎲 🔴

Prérequis : campagne créée, ≥ 1 joueur avec perso **approuvé**, rencontre avec XP.

### 5.1 Table / play panel

- [x] 🔴 Ouvrir campagne → panneau de jeu MJ
- [ ] 🟠 Importer les PJ en combat
  - *Où :* panneau de jeu (session active) → bouton **« Combat + party »** (démarre un combat avec les PJ approuvés) ou, combat déjà ouvert, **« + Party campagne »**.
  - *Prérequis :* joueurs avec personnage **approuvé** dans l’onglet Joueurs.
- [ ] 🔴 Collecter l’initiative (code + lien)
  - *Où :* dans le combat actif, activer la **collecte d’initiative** (génère un code / lien `/campaigns/:id/init` pour les joueurs).
- [ ] 🟠 Voir les jets arriver ; fin de collecte / ordre de tour
- [ ] 🔴 **Distribuer XP** : succès → bouton disparaît (`xpAwarded`) ; pas de double distribution après refresh
- [ ] 🟠 Échec réseau simulé (DevTools offline) : message d’erreur XP, pas de navigation bizarre
- [ ] 🟢 Terminer combat / notes / timeline session



### 5.2 Documents & cartes

- [ ] 🟠 Documents : créer, type **Lettre** (pas « Letter »), publier, épingler
- [ ] 🟠 Empty state : « créez un **document** » (pas « handout »)
- [ ] 🟠 Cartes donjon : bouton **Document** ; toast « brouillon… publiez » ; **Brouillard de guerre** (pas Fog of war)
- [ ] 🟢 Joueur voit documents **publiés** seulement



### 5.3 Persistance

- [ ] 🔴 Éditer notes / handout / carte → attendre debounce → refresh page → **données encore là**
- [ ] 🟠 Deux onglets MJ : pas de perte grossière au save (smoke)

---



## 6. Campagne — côté joueur 👤 🔴

Avec un 2ᵉ compte membre de la campagne.

- [ ] 🔴 Proposition de perso → MJ approuve
- [ ] 🔴 Pendant collecte init : **banner** seulement si **ton** PJ est dans le combat
- [ ] 🔴 Si **pas** importé : pas de faux « Le MJ attend votre initiative » / ou message « pas dans ce combat »
- [ ] 🟠 Page `/campaigns/:id/init` : même empty state clair si non importé
- [ ] 🟠 Saisir un jet → confirmation ; total avec bonus
- [ ] 🟠 Document épinglé / overlay joueur
- [ ] 🟢 XP reçue visible côté joueur (si UI le montre)

---



## 7. Amis & invites ⚙️ 🟠

- [ ] 🟠 Demande d’ami → accepter / refuser
- [ ] 🟠 Invitation campagne → accepter / décliner
- [ ] 🟢 Cas limites : non-ami, doublon, invitation déjà traitée (messages d’erreur OK)

---



## 8. Scénario / aventure 🎲 🟢

- [ ] 🟢 `/story/create` : choisir créatures → rôles → aventure IA → export / sauver en campagne
- [ ] 🟢 PDF bestiaire / pack MJ

---



## 9. Codex & guide 🟢

- [ ] 🟢 Parcourir Classes / Espèces / Sorts (fiche détail s’ouvre)
- [ ] 🟢 Guide / badges navigation (si activés)

---



## 10. Régressions « ne jamais casser » 🔴

- [ ] 🔴 `Élu arcanique` ≠ Eldritch Knight PHB (cf. §2.2)
- [ ] 🔴 Pas d’import JSON joueur dans l’UI
- [ ] 🔴 Libellés joueur en **français** (pas Letter / Handout / Fog / viewer)
- [ ] 🔴 Sauvegarde cloud en échec sur récap : **reste sur la page** avec message (pas reset silencieux)

---



## Matrice rapide (smoke 15 min)

Si tu n’as que 15 minutes, coche uniquement ça :

1. [ ] Login
2. [ ] Créer un Magicien niv. 3 → sauvegarder
3. [ ] Liste Héros → fiche (magie lisible) → PDF
4. [ ] Campagne MJ : import PJ → collect init → XP une fois
5. [ ] Compte joueur : banner init correcte (lié / non lié)
6. [ ] Document type Lettre + label FR cartes

---



## Bugs à noter


| #   | Gravité | Parcours | Attendu | Observé | Capture ? |
| --- | ------- | -------- | ------- | ------- | --------- |
| 1   |         |          |         |         |           |
| 2   |         |          |         |         |           |
| 3   |         |          |         |         |           |


---

*Fichier généré pour la reprise manuelle post-livraisons (wizard UX, campagne, fiche).*  
*Mettre à jour la date dans le tableau §0 après chaque session de test.*