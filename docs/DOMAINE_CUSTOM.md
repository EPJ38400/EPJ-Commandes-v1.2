# Guide — Brancher app.epj-electricite.fr sur Vercel

Procédure pour pointer le domaine `app.epj-electricite.fr` (et `preprod.epj-electricite.fr`) sur le projet Vercel. Compte : 15-30 minutes + délai DNS jusqu'à 48 h.

## Pré-requis

- Le domaine `epj-electricite.fr` est géré chez OVH (ou autre registrar)
- Accès au panneau DNS du registrar
- Accès admin au compte Vercel EPJ

---

## Étape 1 — Ajouter le domaine dans Vercel

1. Aller sur https://vercel.com/dashboard
2. Sélectionner le projet `epj-commandes-v1-2`
3. Settings → Domains
4. Cliquer "Add", saisir `app.epj-electricite.fr`
5. Vercel affiche les enregistrements DNS à créer (CNAME ou A)

## Étape 2 — Créer l'enregistrement DNS chez OVH

1. Se connecter à https://www.ovh.com/manager/
2. Web Cloud → Domaines → `epj-electricite.fr`
3. Onglet "Zone DNS" → Ajouter une entrée

**Pour un sous-domaine (recommandé) :**
- Type : `CNAME`
- Sous-domaine : `app`
- Cible : `cname.vercel-dns.com.`
- TTL : 3600 (1 h)

**Pour la preprod (à faire aussi) :**
- Type : `CNAME`
- Sous-domaine : `preprod`
- Cible : `cname.vercel-dns.com.`
- TTL : 3600

## Étape 3 — Vérifier la propagation DNS

Dans PowerShell :

```powershell
nslookup app.epj-electricite.fr
```

Doit retourner un IP Vercel (76.76.21.21 ou équivalent).

Ou via https://www.whatsmydns.net/ — taper `app.epj-electricite.fr`.

La propagation prend de 5 minutes à 48 h selon le TTL des serveurs DNS intermédiaires.

## Étape 4 — Vérifier dans Vercel

Une fois la propagation OK, Vercel affiche **Valid Configuration** pour le domaine. Le certificat SSL Let's Encrypt est généré automatiquement (5-10 minutes).

L'app est alors accessible sur :
- https://app.epj-electricite.fr (prod)
- https://preprod.epj-electricite.fr (preprod, après setup preprod)

## Étape 5 — Mettre à jour Firebase Auth

**Important** : Firebase Auth bloque les domaines non autorisés.

1. Firebase Console → Authentication → Settings → Authorized domains
2. Ajouter :
   - `app.epj-electricite.fr`
   - `preprod.epj-electricite.fr`

Sinon le login échouera silencieusement sur le nouveau domaine.

## Étape 6 — Communiquer aux utilisateurs

- Garder l'ancienne URL Vercel (`epj-commandes-v1-2.vercel.app`) accessible pendant 1 mois pour les bookmarks anciens
- Email à tous les utilisateurs : "L'app est désormais accessible à `app.epj-electricite.fr`. Mettez à jour vos favoris."
- Mettre à jour les liens dans la signature email, brochures, etc.

---

## Notes

- Le certificat SSL est gratuit et auto-renouvelé par Vercel.
- Si le DNS reste "Invalid Configuration" après 48 h : vérifier que l'enregistrement CNAME pointe bien sur `cname.vercel-dns.com.` (avec le point final), pas sur l'URL Vercel directement.
- Pour utiliser `epj-electricite.fr` (sans sous-domaine) il faut utiliser un enregistrement A et non CNAME — voir doc Vercel.
