# CTD staff users — AHRI production

> **INTERNAL CREDENTIALS** — do not commit to public remotes or share outside
> AHRI / OrbitHealth ops. Created/updated 2026-07-14 via admin
> `POST /rest/UnifiedSystemUser`.

|                      |                                                                              |
| -------------------- | ---------------------------------------------------------------------------- |
| **Login URL**        | https://lims.ahri.gov.et/login                                               |
| **CTD lab unit**     | Test section id **184**, display name **CTD**                                |
| **Role**             | **Lab Manager** (system_role id `126`) on CTD                                |
| **Password pattern** | `FirstnameLastInitial!` (≥8); short first names use `FirstnameLastInitial1!` |

## Mapping note

**CTD** = lab unit / `test_section` named `CTD` (Clinical Trials / CTD
Department).  
Canonical id **184** (same as working `ctd` super-user). Duplicate
inactive-looking CTD rows also exist (181, 243, 263, 283). **Medical
Laboratory** (`303`) is a separate lab unit — not used for these accounts.

## Users

| Full name           | Login         | Password        | Roles assigned          | Status                        | Login verify | Lab unit verify |
| ------------------- | ------------- | --------------- | ----------------------- | ----------------------------- | ------------ | --------------- |
| Wodneh G/meskel     | `Wodneh`      | `WodnehG!`      | Lab Manager → CTD (184) | already existed (roles added) | PASS         | PASS            |
| Kerat Ali           | `Kerat`       | `KeratA1!`      | Lab Manager → CTD (184) | created                       | PASS         | PASS            |
| Muluken Akalu       | `Muluken`     | `MulukenA!`     | Lab Manager → CTD (184) | created                       | PASS         | PASS            |
| Endalkachew Birhanu | `Endalkachew` | `EndalkachewB!` | Lab Manager → CTD (184) | created                       | PASS         | PASS            |
| Derso Furgasa       | `Derso`       | `DersoF1!`      | Lab Manager → CTD (184) | created                       | PASS         | PASS            |
| Mulumebet Hailu     | `Mulumebet`   | `MulumebetH!`   | Lab Manager → CTD (184) | created                       | PASS         | PASS            |

## Login tips

1. Open https://lims.ahri.gov.et/login
2. Enter login + password
3. Select lab unit **CTD** when prompted
4. Users must log out/in after any later role changes for session refresh

## DB confirmation (2026-07-14)

All six accounts have `system_user_role` = Lab Manager and `lab_unit_roles` →
lab unit `184` (CTD).
