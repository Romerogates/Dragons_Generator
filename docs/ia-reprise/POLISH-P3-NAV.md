# Priorité 3 — Polish cosmétique navbar (léger)

Objectif : **affiner** la barre déjà allégée — pas de nouvelles entrées, pas de refonte visuelle lourde.

## État actuel (ne pas défaire)

- Héros + Campagnes à **gauche** (après le logo).
- **Forger** et **Scénario** retirés de la nav (accès via Héros / Campagnes / home).
- Droite : Guide · Amis · Codex · cloche · settings · compte.
- Badges notifs = actions en attente seulement (pas « personnage approuvé » info).

## Peaufinages autorisés

1. **Truncature logo** — éviter « Dragons Ge… » ; ajuster `max-w` / breakpoints, pas changer le wording de marque.
2. **Densité / alignement** — pills Héros/Campagnes vs liens Guide/Amis ; hauteurs `h-10` cohérentes.
3. **Mobile** — ordre : Héros, Campagnes en premier ; pas réintroduire Forger/Scénario en haut.
4. **Cohérence libellés** — « Héros » / « Campagnes » (pas « Mes héros » vs « Héros » si ça crée du bruit).

## Fichiers

- `DragonsGenerator.WEB/src/app/shared/components/navbar/navbar.html`
- `DragonsGenerator.WEB/src/app/shared/components/navbar/navbar.ts`
- Specs navbar s’il en existe ; sinon smoke manuel desktop + mobile width.

## Critères de done

- Diff petit, comportement de navigation inchangé (mêmes routes).
- Pas de nouvel item de menu.
- Lint + tests si touchés.
- Commit seulement si demandé.

## Interdit

- Mega-menu, redesign violet/glow, ajouter Métiers / idle.
- Déplacer Héros/Campagnes à droite « comme avant ».
