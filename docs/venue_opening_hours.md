# Venue Opening Hours Payload

Document de référence pour les mises à jour de venue via `PUT /api/venues/:id`.

## Champs concernés
- `website` (string optionnelle)
- `opening_hours` (objet par jour)
- `happy_hours` (objet par jour)

## Règles `website`
- URL optionnelle (vide autorisé)
- Doit commencer par `http://` ou `https://`
- Identifiants intégrés interdits (`user:pass@...`)
- Domaines locaux interdits (`localhost`, `*.localhost`)
- IP privées/locales interdites (IPv4/IPv6)

## Format d'un jour (`opening_hours.<day>`)
```json
{
  "open": "11:00",
  "close": "23:00",
  "closed": false,
  "close_next_day": false,
  "second_open": "00:30",
  "second_close": "02:00",
  "second_close_next_day": true
}
```

Champs additionnels supportés:
- aucun (maximum 2 créneaux: principal + second)

Tous les horaires doivent être au format `HH:MM` (24h).

## Happy hours
Même structure que `opening_hours` pour `open/close/closed/close_next_day`.

## Notes d'implémentation
- Les jours non transmis peuvent être traités comme non modifiés selon le flux applicatif.
- Côté front partenaire, les jours fermés sont omis du payload d'édition.
