# Suivi vérif — polish Dragons Generator

Fichier vivant : cochable côté **toi** (vérif manuelle) + mis à jour côté agent au fur et à mesure des livraisons.

Dernière MAJ agent : 2026-09-27 — carte Eana contain + aventure par sections éditables

---

## Batch n°1 — Sprint B + polish 10 (livré)

### Fait (agent)

- [x] Chrome `/play` (nav/footer masqués) + Quitter mobile
- [x] Overlays Documents / proposer héros
- [x] Invites toast + Partager natif
- [x] Empty campagnes unifiés « Créer une table »
- [x] Nav md badge hamburger + icônes Donjons/Campagnes
- [x] CTA Envoyer un héros / En attente / Ma fiche
- [x] Onglets hub scroll horizontal
- [x] Pills nav desktop ambre unifiées
- [x] Marque mobile « Dragons »
- [x] CTA Forger héros ambre
- [x] Forge pastilles + `.dg-select`
- [x] Docks messages/session alignés
- [x] Headers Amis / Notifications
- [x] Tokens `--dg-bg` / `--dg-surface`
- [x] Pulse wizard une fois ; select-none chrome ; footer

### À vérifier (toi)

**Table `/play`**

- [ ] Nav + footer absents ; Quitter mobile OK
- [ ] Sans héros → Envoyer un héros (overlay)
- [ ] Pending → En attente du MJ + Changer
- [ ] Refusé → Envoyer un autre héros
- [ ] Approuvé → Ma fiche + retour table
- [ ] Documents overlay sans quitter `/play`
- [ ] MJ : combat / jetons / FoW / chat table OK

**Invites / campagnes**

- [ ] Copier lien → toast vert
- [ ] Partager (si dispo) OK
- [ ] Empty + header + modal = « Créer une table »
- [ ] Filtre vide → Voir toutes
- [ ] Home invite(s) → `/campaigns`

**Nav / chrome**

- [ ] Pills ambre Forger→Campagnes
- [ ] Mobile : Dragons visible
- [ ] Hamburger badge + icônes distinctes
- [ ] Docks FAB côte à côte desktop
- [ ] Footer lisible + Guide toujours

**Héros / forge**

- [ ] CTA Forger ambre
- [ ] Pastilles cliquables + selects chevron
- [ ] Hint wizard pulse une fois
- [ ] Sélection texte noms OK (pas select-none global)

---

## Batch n°2 — 10 suivants (livré)

### Fait (agent)

- [x] 1. Onboarding rôle → étape 2 avec CTA table (MJ) / forge (joueur)
- [x] 2. Forge sans compte : banner cloud dès l’étape 1
- [x] 3. Forge : Télécharger le Codex sur place (plus seulement Paramètres)
- [x] 4. `--dg-banner-height` mesuré via DOM `[data-dg-banner]` (+ fallback)
- [x] 5. Amis : onglet Demandes auto si pending au 1er chargement
- [x] 6. Recherche amis : hint pseudo exact + bouton Copier mon pseudo visible
- [x] 7. Menu Codex : champ « Filtrer le grimoire » (desktop + mobile)
- [x] 8. Fiche : aide Illustrée = PDF/table · Compacte = lecture écran
- [x] 9. Carrousel espèces + classes (mobile) : dots + nom sous la carte
- [x] 10. Guide mobile : sommaire drawer plein écran (`.guide-sommaire-drawer-open`)

### À vérifier (toi)

- [ ] Onboarding MJ → CTA campagnes + Guide MJ ; Joueur → forge + campagnes ; « Rester sur l’accueil »
- [ ] `/create` déconnecté : banner connexion dès le début
- [ ] `/create` : bouton Télécharger le Codex (en ligne) ; hors ligne sans Codex = message reconnect
- [ ] Bannières empilées : sticky onglets hub /play correctement sous le chrome
- [ ] Amis avec demandes → ouvre Demandes au 1er load (pas Découvrir)
- [ ] Copier mon pseudo + hint recherche
- [ ] Codex navbar : filtre réduit la liste
- [ ] Fiche : texte d’aide Illustrée / Compacte clair
- [ ] Carrousel espèces/classes : dots + nom ; clic dot centre la carte
- [ ] Guide mobile : Sommaire = plein écran ; Fermer revient

---

## Notes / bugs trouvés en vérif

- **2026-09-27 — Scénario / vies créatures** : console `401 auth/me` (session, sans lien avec l’IA) + `502 generate-creature-stories-batch` + éventuel `504`. Comportement : le lot échoue → le front bascule en génération **une par une** ; les vies déjà remplies sont OK. Correctif UX : bandeau ambre « on continue une à la fois » + message partiel « X ok / Y échecs ».
- **2026-09-27 — Scénario / carte + aventure** : carte en **contain** (quasi entière), pills sous la carte, fades réduits ; aventure éditée en **7 sections** (Accroche… Pistes MJ) + bascule « Texte brut ».
