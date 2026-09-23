# Firestore production patch — Web settings schema v2

Tefsen Web appearance settings use:

- `schemaVersion: 2`
- `theme: "light" | "dark" | "system"`

The isolated Web emulator rule file in `firebase-tests/firestore.web-v1.test.rules` now supports both the legacy v1 dark-only document and the new v2 themes.

## Production rule change

The repository does not contain Tefsen's full production Firestore rules. Do **not** deploy the isolated emulator rules over production.

In the existing production rule for:

```
/users/{uid}/settings/{settingsId}
```

replace the old dark-only checks:

```
request.resource.data.schemaVersion == 1
request.resource.data.theme == "dark"
```

with the migration-safe condition:

```
(
  (request.resource.data.schemaVersion == 1 && request.resource.data.theme == "dark")
  || (
    request.resource.data.schemaVersion == 2
    && (
      request.resource.data.theme == "light"
      || request.resource.data.theme == "dark"
      || request.resource.data.theme == "system"
    )
  )
)
```

Keep the existing owner-only identity checks, allowed-key list, type checks, and field-size limits unchanged.

## Compatibility behavior

Until the production rule is updated, Tefsen Web keeps a Light/Dark/System choice in the signed-in user's browser cache and attempts a backward-compatible v1 write for the other settings fields. Once production accepts schema v2, normal Firestore sync resumes automatically.
