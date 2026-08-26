# E-mails Dragons Generator — SPF / DKIM / DMARC (OVH)

Domaine : **romerogates.be**  
Expéditeur : **dragons@romerogates.be** via `smtp.mail.ovh.net:465`

Sans SPF + DKIM, Gmail / Outlook classent souvent les mails (confirmation, reset MDP, tickets) en spam.

État constaté (août 2026) : MX OVH OK, **pas de SPF TXT**, **pas de DKIM**, **pas de DMARC**.

---

## 1. SPF (obligatoire)

Dans le [manager OVH](https://www.ovh.com/manager/) → **Domaines** → `romerogates.be` → **Zone DNS** :

| Champ | Valeur |
|--------|--------|
| Type | `TXT` |
| Sous-domaine | *(vide = racine)* |
| TTL | `3600` |
| Valeur | `v=spf1 include:mx.ovh.com ~all` |

Si un TXT SPF existe déjà, **ne pas en créer un second** : fusionne les `include:` dans **un seul** enregistrement.

Guide OVH : https://docs.ovhcloud.com/fr/domains/dns-zone-spf/

---

## 2. DKIM (obligatoire pour Gmail)

1. Manager OVH → **Emails** (ou **MX Plan**) → compte lié à `romerogates.be`
2. Onglet **Informations générales** → section **DKIM** → **Configurer / Activer**
3. OVH affiche **2 enregistrements CNAME** (souvent `ovhselector1._domainkey` et `ovhselector2._domainkey`)
4. Ajoute-les **tels quels** dans la zone DNS de `romerogates.be`
5. Attends la propagation (souvent 5–60 min), puis clique **Activer** dans le manager

Guide OVH : https://docs.ovhcloud.com/fr/emails/email-dkim/

> Les sélecteurs exacts sont générés par OVH : ne pas inventer les CNAME à la main.

---

## 3. DMARC (recommandé)

| Champ | Valeur |
|--------|--------|
| Type | `TXT` |
| Sous-domaine | `_dmarc` |
| Valeur | `v=DMARC1; p=none; rua=mailto:dragons@romerogates.be; adkim=r; aspf=r` |

Commence avec `p=none` (surveillance). Quand SPF/DKIM passent au vert, tu pourras monter à `p=quarantine`.

Guide OVH : https://docs.ovhcloud.com/fr/domains/dns-zone-dmarc/

---

## 4. Vérification

Après propagation :

```powershell
nslookup -type=TXT romerogates.be 8.8.8.8
nslookup -type=TXT _dmarc.romerogates.be 8.8.8.8
```

Outils en ligne :
- https://mxtoolbox.com/spf.aspx → `romerogates.be`
- https://mxtoolbox.com/dkim.aspx → domaine + sélecteur OVH
- https://www.mail-tester.com/ → envoi depuis l’app vers l’adresse fournie

Côté app : déclencher un reset MDP ou un mail de confirmation vers Gmail, puis ouvrir les en-têtes du message (`Authentication-Results`) : tu dois voir `spf=pass` et `dkim=pass`.

---

## 5. Rappel config app (déjà en place)

Variables dans `.env` (compose local / prod) :

```env
Smtp__Host=smtp.mail.ovh.net
Smtp__Port=465
Smtp__UserName=dragons@romerogates.be
Smtp__FromEmail=dragons@romerogates.be
Smtp__FromName=Dragons Generator
```

Le DNS ne se configure **pas** dans le code : uniquement dans la zone OVH du domaine.
