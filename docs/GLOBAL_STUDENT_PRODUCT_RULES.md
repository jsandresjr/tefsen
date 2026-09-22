# Tefsen Global Student Product Rules

Tefsen is a global student opportunity and journey platform.

## Non-negotiable product rule

**A student's country or nationality is profile data, never a platform default.**

Tefsen must not assume Sri Lanka, the United States, the United Kingdom, India, Europe, or any other single geography in the core product experience.

## UI and copy

Core UI copy must remain country-neutral:

- Student Passport asks for the student's actual nationality/country.
- Opportunity discovery filters use catalogue data dynamically.
- Destination country is opportunity data.
- Eligibility compares the student's stored nationality to structured opportunity rules.
- Unknown nationality rules are shown as unknown and linked back to the official source.
- No country is automatically treated as preferred.
- No country-specific scholarship should be presented as globally eligible.

Country-specific opportunities are valid catalogue records, but they must clearly show their country/nationality scope.

## Recommendations

Recommendation logic may use:

- student's nationality
- current country
- target study level
- field of study
- preferred destination countries
- funding preference
- structured opportunity eligibility

It must not infer or force a nationality from device location, IP location, account location, or developer defaults.

## Trust

When eligibility varies by country, Tefsen must say so.

The official provider source remains authoritative for:

- eligible nationalities/countries
- deadlines
- visa/legal requirements
- funding package
- programme-specific entry requirements

## Data diversity

The production opportunity catalogue should intentionally expand across regions and should not be evaluated as complete while it disproportionately represents one country or destination.

Future catalogue quality audits should review geographic coverage across:

- Africa
- Asia
- Europe
- North America
- Latin America and the Caribbean
- Middle East
- Oceania
- multi-country/global opportunities

This is a coverage goal, not a quota or eligibility rule.
