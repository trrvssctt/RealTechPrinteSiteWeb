# Modélisation SaaS devERP - Partie 2
## API, Sécurité, Migration et Implémentation

**Continuation de:** [MODELISATION_SAAS_DEVERP.md](./MODELISATION_SAAS_DEVERP.md)

---

## 7. API Endpoints et Contrats

### 7.1 Structure des Routes API

```
BASE_URL: https://{tenant}.deverp.sn/api/v1

┌──────────────────────────────────────────────────────────────────┐
│                    ROUTES PUBLIQUES (No Auth)                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  POST   /login                      Authentification              │
│  POST   /refresh                    Rafraîchir token              │
│  POST   /forgot-password            Demande reset password        │
│  POST   /reset-password             Reset password                │
│                                                                   │
│  GET    /formations                 Liste formations publiques    │
│  GET    /formations/{id}            Détails formation             │
│  GET    /filieres                   Liste filières                │
│                                                                   │
│  POST   /inscriptions               Créer inscription             │
│  POST   /suivi-dossier/verifier     Suivre dossier (code_suivi)  │
│                                                                   │
│  POST   /paiements                  Créer paiement                │
│  GET    /paiements/{id}/statut      Vérifier statut paiement      │
│                                                                   │
│  POST   /webhooks/wave              Webhook Wave                  │
│  POST   /webhooks/orange-money      Webhook Orange Money          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│               ROUTES AUTHENTIFIÉES (Auth Required)                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE AUTH & USER                                        │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  POST   /logout                  Déconnexion               │ │
│  │  GET    /me                      Profil utilisateur        │ │
│  │  PUT    /me                      Modifier profil           │ │
│  │  PUT    /me/password             Changer mot de passe      │ │
│  │  GET    /me/permissions          Mes permissions           │ │
│  │                                                             │ │
│  │  GET    /users                   Liste utilisateurs        │ │
│  │  POST   /users                   Créer utilisateur         │ │
│  │  GET    /users/{id}              Détails utilisateur       │ │
│  │  PUT    /users/{id}              Modifier utilisateur      │ │
│  │  DELETE /users/{id}              Supprimer utilisateur     │ │
│  │  POST   /users/{id}/activate     Activer utilisateur       │ │
│  │  POST   /users/{id}/deactivate   Désactiver utilisateur    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE INSCRIPTIONS                                       │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  GET    /inscriptions            Liste inscriptions        │ │
│  │  GET    /inscriptions/{id}       Détails inscription       │ │
│  │  PUT    /inscriptions/{id}       Modifier inscription      │ │
│  │  DELETE /inscriptions/{id}       Supprimer inscription     │ │
│  │  POST   /inscriptions/{id}/valider  Valider inscription    │ │
│  │  POST   /inscriptions/{id}/rejeter  Rejeter inscription    │ │
│  │  GET    /inscriptions/stats      Statistiques               │ │
│  │  GET    /inscriptions/export     Exporter (Excel/PDF)      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE DOSSIERS                                           │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  GET    /dossiers                Liste dossiers            │ │
│  │  GET    /dossiers/en-attente     Dossiers en attente       │ │
│  │  GET    /dossiers/{id}           Détails dossier           │ │
│  │  PUT    /dossiers/{id}/statut    Modifier statut           │ │
│  │  POST   /dossiers/{id}/valider   Valider dossier complet   │ │
│  │  POST   /dossiers/{id}/rejeter   Rejeter dossier           │ │
│  │                                                             │ │
│  │  POST   /documents/upload        Upload document           │ │
│  │  GET    /documents/{id}          Détails document          │ │
│  │  GET    /documents/{id}/preview  Prévisualiser document    │ │
│  │  DELETE /documents/{id}          Supprimer document        │ │
│  │  POST   /documents/{id}/valider  Valider document          │ │
│  │  POST   /documents/{id}/rejeter  Rejeter document          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE PAIEMENTS                                          │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  GET    /paiements               Liste paiements           │ │
│  │  GET    /paiements/{id}          Détails paiement          │ │
│  │  POST   /paiements/{id}/valider  Valider paiement          │ │
│  │  POST   /paiements/{id}/annuler  Annuler paiement          │ │
│  │  GET    /paiements/{id}/facture  Télécharger facture PDF   │ │
│  │  GET    /paiements/stats         Statistiques financières  │ │
│  │                                                             │ │
│  │  GET    /modes-paiement          Liste modes paiement      │ │
│  │  POST   /modes-paiement          Créer mode paiement       │ │
│  │  PUT    /modes-paiement/{id}     Modifier mode paiement    │ │
│  │  DELETE /modes-paiement/{id}     Supprimer mode paiement   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE ÉTUDIANTS                                          │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  GET    /etudiants               Liste étudiants           │ │
│  │  POST   /etudiants               Créer étudiant (manuel)   │ │
│  │  GET    /etudiants/{id}          Détails étudiant          │ │
│  │  PUT    /etudiants/{id}          Modifier étudiant         │ │
│  │  DELETE /etudiants/{id}          Supprimer étudiant        │ │
│  │  GET    /etudiants/{id}/carte    Télécharger carte         │ │
│  │  GET    /etudiants/stats         Statistiques étudiants    │ │
│  │  GET    /etudiants/export        Exporter liste            │ │
│  │                                                             │ │
│  │  GET    /etudiants/me            Mon profil (étudiant)     │ │
│  │  GET    /etudiants/me/notes      Mes notes                 │ │
│  │  GET    /etudiants/me/emploi-temps  Mon emploi du temps    │ │
│  │  GET    /etudiants/me/documents  Mes documents             │ │
│  │  GET    /etudiants/me/paiements  Mes paiements             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE FORMATIONS & ACADÉMIQUE                            │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  GET    /formations              Liste formations          │ │
│  │  POST   /formations              Créer formation           │ │
│  │  GET    /formations/{id}         Détails formation         │ │
│  │  PUT    /formations/{id}         Modifier formation        │ │
│  │  DELETE /formations/{id}         Supprimer formation       │ │
│  │                                                             │ │
│  │  GET    /filieres                Liste filières            │ │
│  │  POST   /filieres                Créer filière             │ │
│  │  GET    /filieres/{id}           Détails filière           │ │
│  │  PUT    /filieres/{id}           Modifier filière          │ │
│  │  DELETE /filieres/{id}           Supprimer filière         │ │
│  │                                                             │ │
│  │  GET    /departements            Liste départements        │ │
│  │  POST   /departements            Créer département         │ │
│  │  GET    /departements/{id}       Détails département       │ │
│  │  PUT    /departements/{id}       Modifier département      │ │
│  │  DELETE /departements/{id}       Supprimer département     │ │
│  │                                                             │ │
│  │  GET    /cours                   Liste cours               │ │
│  │  POST   /cours                   Créer cours               │ │
│  │  GET    /cours/{id}              Détails cours             │ │
│  │  PUT    /cours/{id}              Modifier cours            │ │
│  │  DELETE /cours/{id}              Supprimer cours           │ │
│  │                                                             │ │
│  │  GET    /niveaux-etudes          Liste niveaux             │ │
│  │  GET    /modalites               Liste modalités           │ │
│  │  GET    /certifications          Liste certifications      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE NOTES & ÉVALUATIONS                                │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  GET    /evaluations             Liste évaluations         │ │
│  │  POST   /evaluations             Créer évaluation          │ │
│  │  GET    /evaluations/{id}        Détails évaluation        │ │
│  │  PUT    /evaluations/{id}        Modifier évaluation       │ │
│  │  DELETE /evaluations/{id}        Supprimer évaluation      │ │
│  │                                                             │ │
│  │  GET    /notes                   Liste notes               │ │
│  │  POST   /notes                   Créer note                │ │
│  │  PUT    /notes/{id}              Modifier note             │ │
│  │  DELETE /notes/{id}              Supprimer note            │ │
│  │  POST   /notes/import            Import notes (Excel)      │ │
│  │                                                             │ │
│  │  GET    /bulletins               Liste bulletins           │ │
│  │  GET    /bulletins/{id}          Télécharger bulletin PDF  │ │
│  │  POST   /bulletins/generer       Générer bulletins         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE RAPPORTS                                           │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  POST   /rapports/generer        Générer rapport (async)   │ │
│  │  GET    /rapports                Liste rapports générés    │ │
│  │  GET    /rapports/{id}           Détails rapport           │ │
│  │  GET    /rapports/{id}/download  Télécharger rapport       │ │
│  │  DELETE /rapports/{id}           Supprimer rapport         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  MODULE CONFIGURATION (Admin Only)                         │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │  GET    /config/etablissement    Config établissement      │ │
│  │  PUT    /config/etablissement    Modifier config           │ │
│  │  PUT    /config/branding         Modifier branding         │ │
│  │  PUT    /config/email            Config email SMTP         │ │
│  │  PUT    /config/paiement         Config paiements          │ │
│  │                                                             │ │
│  │  GET    /roles                   Liste rôles               │ │
│  │  POST   /roles                   Créer rôle                │ │
│  │  GET    /roles/{id}              Détails rôle              │ │
│  │  PUT    /roles/{id}              Modifier rôle             │ │
│  │  DELETE /roles/{id}              Supprimer rôle            │ │
│  │                                                             │ │
│  │  GET    /permissions             Liste permissions         │ │
│  │  POST   /roles/{id}/permissions  Assigner permissions      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│          ROUTES SUPER-ADMIN (Super Admin Portal Only)            │
│               BASE: https://admin.deverp.sn/api/v1               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GET    /etablissements              Liste établissements        │
│  POST   /etablissements              Créer établissement         │
│  GET    /etablissements/{id}         Détails établissement       │
│  PUT    /etablissements/{id}         Modifier établissement      │
│  DELETE /etablissements/{id}         Supprimer établissement     │
│  POST   /etablissements/{id}/activate    Activer établissement   │
│  POST   /etablissements/{id}/suspend     Suspendre établissement │
│                                                                   │
│  GET    /plans-abonnement            Liste plans                 │
│  POST   /plans-abonnement            Créer plan                  │
│  PUT    /plans-abonnement/{id}       Modifier plan               │
│  DELETE /plans-abonnement/{id}       Supprimer plan              │
│                                                                   │
│  GET    /usage/global                Statistiques globales       │
│  GET    /usage/{etablissement_id}    Usage par établissement     │
│                                                                   │
│  GET    /facturation                 Liste factures              │
│  GET    /facturation/{id}            Détails facture             │
│  POST   /facturation/generer         Générer factures mensuelles │
│                                                                   │
│  GET    /support/tickets             Liste tickets support       │
│  GET    /support/tickets/{id}        Détails ticket              │
│  PUT    /support/tickets/{id}        Mettre à jour ticket        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Contrats API (Exemples Détaillés)

#### 7.2.1 Authentification

**POST /api/v1/login**

Request:
```json
{
  "login": "admin@ucad.sn",
  "password": "SecurePassword123!"
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "def50200a8f9b3c...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": 123,
      "etablissement_id": 1,
      "nom": "DIALLO",
      "prenom": "Amadou",
      "email": "admin@ucad.sn",
      "role": {
        "id": 1,
        "nom": "Administrateur",
        "slug": "admin"
      },
      "permissions": [
        "read:inscriptions",
        "write:inscriptions",
        "validate:dossiers",
        "manage:users"
      ],
      "avatar_url": "https://res.cloudinary.com/..."
    },
    "etablissement": {
      "id": 1,
      "nom": "Université Cheikh Anta Diop",
      "domaine": "ucad.deverp.sn",
      "logo_url": "https://...",
      "couleur_primaire": "#003366",
      "couleur_secondaire": "#FFD700"
    }
  },
  "message": "Connexion réussie"
}
```

Error Response (401 Unauthorized):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email ou mot de passe incorrect",
    "details": null
  }
}
```

Error Response (403 Forbidden - Tenant Suspended):
```json
{
  "success": false,
  "error": {
    "code": "TENANT_SUSPENDED",
    "message": "Établissement suspendu",
    "details": {
      "raison": "Abonnement impayé",
      "date_suspension": "2025-01-05T10:30:00Z",
      "contact_support": "support@deverp.sn"
    }
  }
}
```

#### 7.2.2 Créer Inscription

**POST /api/v1/inscriptions**

Request:
```json
{
  "candidat": {
    "nom": "KANE",
    "prenom": "Fatou",
    "email": "fatou.kane@example.com",
    "telephone": "+221771234567",
    "date_naissance": "2003-05-15",
    "lieu_naissance": "Dakar",
    "nationalite": "Sénégalaise",
    "genre": "F",
    "adresse": "Parcelles Assainies, Dakar",
    "ville": "Dakar",
    "code_postal": "12500"
  },
  "scolarite": {
    "niveau_etudes_precedent": "Baccalauréat Série S",
    "filiere_id": 1,
    "formation_id": 5,
    "modalite_id": 1,
    "annee_academique": "2025-2026"
  },
  "tuteur": {
    "nom": "KANE",
    "prenom": "Moussa",
    "email": "moussa.kane@example.com",
    "telephone": "+221775555555",
    "adresse": "Parcelles Assainies, Dakar",
    "profession": "Enseignant",
    "employeur": "Lycée Blaise Diagne",
    "lien_parente": "Père"
  }
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "inscription": {
      "id": 456,
      "code_suivi": "UCAD-2025-00456",
      "statut": "brouillon",
      "candidat": {
        "nom": "KANE",
        "prenom": "Fatou",
        "email": "fatou.kane@example.com",
        "telephone": "+221771234567"
      },
      "formation": {
        "id": 5,
        "nom": "Licence Informatique",
        "filiere": "Sciences et Technologies",
        "duree": "3 ans"
      },
      "created_at": "2025-01-10T14:30:00Z"
    },
    "dossier": {
      "id": 789,
      "code_suivi": "UCAD-2025-00456",
      "statut": "incomplet",
      "progression": 0,
      "documents_requis": [
        {
          "type_id": 1,
          "nom": "Pièce d'identité (CNI/Passeport)",
          "obligatoire": true,
          "statut": "manquant"
        },
        {
          "type_id": 2,
          "nom": "Diplôme du Baccalauréat",
          "obligatoire": true,
          "statut": "manquant"
        },
        {
          "type_id": 3,
          "nom": "Certificat médical",
          "obligatoire": false,
          "statut": "non_fourni"
        },
        {
          "type_id": 4,
          "nom": "Photo d'identité",
          "obligatoire": true,
          "statut": "manquant"
        }
      ]
    },
    "frais_inscription": {
      "droit_inscription": 50000,
      "frais_scolarite": 200000,
      "montant_total": 250000,
      "devise": "XOF"
    },
    "prochaines_etapes": [
      "Télécharger les documents requis",
      "Attendre la validation du dossier",
      "Procéder au paiement des frais"
    ]
  },
  "message": "Inscription créée avec succès. Consultez votre email pour les prochaines étapes."
}
```

Validation Error (422 Unprocessable Entity):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Erreurs de validation",
    "details": {
      "candidat.email": [
        "L'adresse email est déjà utilisée"
      ],
      "candidat.date_naissance": [
        "Le candidat doit avoir au moins 16 ans"
      ],
      "scolarite.formation_id": [
        "La formation sélectionnée n'est pas disponible"
      ]
    }
  }
}
```

#### 7.2.3 Upload Document

**POST /api/v1/documents/upload**

Request (multipart/form-data):
```
dossier_id: 789
type_document_id: 1
file: [binary data - CNI.pdf]
```

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "document": {
      "id": 1024,
      "dossier_id": 789,
      "type_document": {
        "id": 1,
        "nom": "Pièce d'identité (CNI/Passeport)",
        "obligatoire": true
      },
      "nom_fichier": "CNI_KANE_Fatou.pdf",
      "url": "https://res.cloudinary.com/deverp/image/upload/v1704897000/etablissement_1/dossiers/789/cni_kane_fatou.pdf",
      "url_thumbnail": "https://res.cloudinary.com/deverp/image/upload/c_thumb,w_200,h_200/v1704897000/...",
      "taille": 245678,
      "mime_type": "application/pdf",
      "statut": "en_attente",
      "uploaded_at": "2025-01-10T15:45:00Z"
    },
    "dossier": {
      "id": 789,
      "progression": 25,
      "documents_fournis": 1,
      "documents_requis": 4,
      "statut": "incomplet"
    }
  },
  "message": "Document uploadé avec succès. En attente de validation."
}
```

Error (413 Payload Too Large):
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "Le fichier est trop volumineux",
    "details": {
      "max_size": "10MB",
      "file_size": "15MB"
    }
  }
}
```

#### 7.2.4 Créer Paiement

**POST /api/v1/paiements**

Request:
```json
{
  "inscription_id": 456,
  "mode_paiement_id": 1,
  "lignes_paiement": [
    {
      "type_frais_id": 1,
      "description": "Droit d'inscription",
      "montant": 50000
    },
    {
      "type_frais_id": 2,
      "description": "Frais de scolarité - Semestre 1",
      "montant": 200000
    }
  ]
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "paiement": {
      "id": 2048,
      "inscription_id": 456,
      "reference": "PAY-UCAD-2025-2048",
      "mode_paiement": {
        "id": 1,
        "nom": "Wave",
        "type": "mobile_money",
        "provider": "wave"
      },
      "montant_total": 250000,
      "montant_paye": 0,
      "reste_a_payer": 250000,
      "devise": "XOF",
      "statut": "en_attente",
      "lignes_paiement": [
        {
          "id": 5001,
          "type_frais": "Droit d'inscription",
          "montant": 50000
        },
        {
          "id": 5002,
          "type_frais": "Frais de scolarité - Semestre 1",
          "montant": 200000
        }
      ],
      "created_at": "2025-01-10T16:00:00Z"
    },
    "checkout": {
      "provider": "wave",
      "checkout_url": "https://pay.wave.com/checkout/abc123xyz",
      "reference_externe": "WAVE_REF_789456",
      "expires_at": "2025-01-10T17:00:00Z"
    },
    "facture_pdf_url": "https://storage.deverp.sn/factures/etablissement_1/2025/facture_2048.pdf"
  },
  "message": "Paiement initié. Redirigez l'utilisateur vers checkout_url pour compléter le paiement."
}
```

#### 7.2.5 Valider Paiement (Webhook)

**POST /api/v1/webhooks/wave** (Called by Wave)

Request:
```json
{
  "event": "payment.success",
  "data": {
    "reference": "WAVE_REF_789456",
    "amount": 250000,
    "currency": "XOF",
    "customer_phone": "+221771234567",
    "transaction_id": "wave_txn_abc123",
    "timestamp": "2025-01-10T16:05:30Z"
  },
  "signature": "sha256_hmac_signature_here"
}
```

Internal Processing → Calls:
**POST /api/v1/paiements/{id}/valider** (Internal)

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "paiement": {
      "id": 2048,
      "statut": "valide",
      "montant_paye": 250000,
      "reste_a_payer": 0,
      "date_paiement": "2025-01-10T16:05:30Z",
      "reference_externe": "WAVE_REF_789456"
    },
    "inscription": {
      "id": 456,
      "statut": "valide"
    },
    "etudiant": {
      "id": 789,
      "matricule": "UCAD2025001",
      "email_institutionnel": "fatou.kane@etudiant.ucad.sn",
      "nom": "KANE",
      "prenom": "Fatou",
      "formation": "Licence Informatique",
      "niveau": "L1",
      "annee_academique": "2025-2026",
      "carte_etudiant_url": "https://storage.deverp.sn/cartes/etablissement_1/carte_UCAD2025001.pdf",
      "created_at": "2025-01-10T16:05:35Z"
    },
    "credentials_temporaires": {
      "email": "fatou.kane@etudiant.ucad.sn",
      "password_temporaire": "TempPass2025!",
      "doit_changer_password": true,
      "expiration": "2025-01-17T16:05:35Z"
    }
  },
  "message": "Paiement validé. Étudiant créé avec succès. Email de bienvenue envoyé."
}
```

#### 7.2.6 Liste Étudiants (Paginée + Filtres)

**GET /api/v1/etudiants?page=1&per_page=20&filiere_id=1&statut=actif&search=kane**

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "etudiants": [
      {
        "id": 789,
        "matricule": "UCAD2025001",
        "nom": "KANE",
        "prenom": "Fatou",
        "email_institutionnel": "fatou.kane@etudiant.ucad.sn",
        "telephone": "+221771234567",
        "formation": {
          "id": 5,
          "nom": "Licence Informatique"
        },
        "filiere": {
          "id": 1,
          "nom": "Sciences et Technologies"
        },
        "niveau": {
          "id": 1,
          "nom": "Première année (L1)"
        },
        "statut": "actif",
        "annee_entree": 2025,
        "photo_url": "https://res.cloudinary.com/...",
        "created_at": "2025-01-10T16:05:35Z"
      }
      // ... autres étudiants
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 1250,
      "total_pages": 63,
      "from": 1,
      "to": 20,
      "has_more": true
    },
    "filters_applied": {
      "filiere_id": 1,
      "statut": "actif",
      "search": "kane"
    }
  }
}
```

#### 7.2.7 Génération Rapport (Async)

**POST /api/v1/rapports/generer**

Request:
```json
{
  "type": "liste_etudiants",
  "format": "excel",
  "filters": {
    "filiere_id": 1,
    "niveau_id": 1,
    "annee_academique": "2024-2025",
    "statut": "actif"
  },
  "colonnes": [
    "matricule",
    "nom",
    "prenom",
    "email",
    "formation",
    "filiere",
    "niveau",
    "statut"
  ]
}
```

Response (202 Accepted):
```json
{
  "success": true,
  "data": {
    "job_id": "report_12345",
    "statut": "pending",
    "type": "liste_etudiants",
    "format": "excel",
    "estimated_time_seconds": 45,
    "webhook_url": null,
    "created_at": "2025-01-10T17:00:00Z"
  },
  "message": "Rapport en cours de génération. Vous recevrez une notification par email lorsqu'il sera prêt."
}
```

WebSocket/Pusher Event (quand terminé):
```json
{
  "event": "rapport.ready",
  "data": {
    "job_id": "report_12345",
    "rapport_id": 567,
    "filename": "etudiants_2025-01-10_170045.xlsx",
    "download_url": "/api/v1/rapports/567/download",
    "taille": "2.4 MB",
    "nb_lignes": 1250,
    "generated_at": "2025-01-10T17:00:45Z"
  }
}
```

**GET /api/v1/rapports/567/download**

Response: Binary file download (Excel)

### 7.3 Codes d'Erreur Standards

```
┌──────────────────────────────────────────────────────────────────┐
│                    CODES D'ERREUR STANDARDS                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  HTTP 400 - Bad Request                                          │
│    - INVALID_REQUEST: Requête mal formée                         │
│    - MISSING_PARAMETER: Paramètre requis manquant                │
│    - INVALID_PARAMETER: Paramètre invalide                       │
│                                                                   │
│  HTTP 401 - Unauthorized                                         │
│    - INVALID_CREDENTIALS: Email/mot de passe incorrect           │
│    - TOKEN_EXPIRED: Token expiré                                 │
│    - TOKEN_INVALID: Token invalide ou révoqué                    │
│    - REFRESH_TOKEN_EXPIRED: Refresh token expiré                 │
│                                                                   │
│  HTTP 403 - Forbidden                                            │
│    - INSUFFICIENT_PERMISSIONS: Permissions insuffisantes         │
│    - TENANT_SUSPENDED: Établissement suspendu                    │
│    - TENANT_EXPIRED: Abonnement expiré                           │
│    - ACCOUNT_DISABLED: Compte utilisateur désactivé              │
│    - QUOTA_EXCEEDED: Quota dépassé                               │
│                                                                   │
│  HTTP 404 - Not Found                                            │
│    - RESOURCE_NOT_FOUND: Ressource introuvable                   │
│    - TENANT_NOT_FOUND: Établissement introuvable                 │
│    - ENDPOINT_NOT_FOUND: Endpoint n'existe pas                   │
│                                                                   │
│  HTTP 409 - Conflict                                             │
│    - RESOURCE_ALREADY_EXISTS: Ressource déjà existante           │
│    - DUPLICATE_EMAIL: Email déjà utilisé                         │
│    - DUPLICATE_MATRICULE: Matricule déjà utilisé                 │
│    - CONCURRENT_UPDATE: Modification concurrente détectée        │
│                                                                   │
│  HTTP 413 - Payload Too Large                                    │
│    - FILE_TOO_LARGE: Fichier trop volumineux                     │
│    - REQUEST_TOO_LARGE: Requête trop volumineuse                 │
│                                                                   │
│  HTTP 422 - Unprocessable Entity                                 │
│    - VALIDATION_ERROR: Erreurs de validation                     │
│    - BUSINESS_RULE_VIOLATION: Règle métier violée                │
│                                                                   │
│  HTTP 429 - Too Many Requests                                    │
│    - RATE_LIMIT_EXCEEDED: Limite de requêtes dépassée            │
│                                                                   │
│  HTTP 500 - Internal Server Error                                │
│    - INTERNAL_ERROR: Erreur serveur interne                      │
│    - DATABASE_ERROR: Erreur base de données                      │
│    - EXTERNAL_SERVICE_ERROR: Erreur service externe              │
│                                                                   │
│  HTTP 503 - Service Unavailable                                  │
│    - SERVICE_MAINTENANCE: Maintenance en cours                   │
│    - SERVICE_OVERLOADED: Service surchargé                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Sécurité et Authentification

### 8.1 OAuth2 avec Laravel Passport

**Configuration Passport:**

```php
// config/auth.php
'guards' => [
    'api' => [
        'driver' => 'passport',
        'provider' => 'users',
    ],
],

// AuthServiceProvider.php
use Laravel\Passport\Passport;

public function boot()
{
    Passport::tokensExpireIn(now()->addHours(1));
    Passport::refreshTokensExpireIn(now()->addDays(14));
    Passport::personalAccessTokensExpireIn(now()->addMonths(6));

    // Scopes (optionnel pour granular permissions)
    Passport::tokensCan([
        'read-notes' => 'Lire les notes',
        'write-notes' => 'Modifier les notes',
        'manage-users' => 'Gérer les utilisateurs',
    ]);
}
```

### 8.2 RBAC (Role-Based Access Control)

**Structure des Permissions:**

```
┌──────────────────────────────────────────────────────────────────┐
│                   SYSTÈME DE PERMISSIONS RBAC                     │
└──────────────────────────────────────────────────────────────────┘

NOTATION: {action}:{resource}

Actions:
  - read      Lire/consulter
  - write     Créer/modifier
  - delete    Supprimer
  - validate  Valider (workflow)
  - manage    Gestion complète (all CRUD)

Resources:
  - inscriptions
  - dossiers
  - documents
  - paiements
  - etudiants
  - notes
  - formations
  - users
  - config
  - rapports

Exemples:
  - read:inscriptions        → Voir liste inscriptions
  - write:inscriptions       → Créer/modifier inscriptions
  - validate:dossiers        → Valider dossiers
  - manage:users             → Gestion complète utilisateurs
  - read:notes               → Consulter notes (étudiant)
  - write:notes              → Saisir notes (enseignant)

┌──────────────────────────────────────────────────────────────────┐
│                        RÔLES PRÉDÉFINIS                           │
└──────────────────────────────────────────────────────────────────┘

1. Super Admin (Hors tenant)
   - manage:*                 → Toutes permissions sur tout

2. Administrateur Établissement
   - manage:users
   - manage:inscriptions
   - manage:dossiers
   - manage:paiements
   - manage:formations
   - manage:etudiants
   - read:rapports
   - write:config

3. Personnel Administratif (Staff)
   - read:inscriptions
   - write:inscriptions
   - validate:dossiers
   - read:documents
   - validate:documents
   - read:paiements
   - write:paiements

4. Enseignant
   - read:etudiants
   - read:formations
   - read:cours
   - write:notes
   - read:evaluations
   - write:evaluations

5. Étudiant
   - read:notes (own)
   - read:emploi-temps (own)
   - read:documents (own)
   - read:paiements (own)
   - write:documents (upload own)

6. Tuteur
   - read:etudiants (related)
   - read:notes (related)
   - read:paiements (related)
   - write:paiements (related)
```

**Middleware Permission Check:**

```php
// app/Http/Middleware/CheckPermission.php
class CheckPermission
{
    public function handle($request, Closure $next, $permission)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'error' => 'Non authentifié'
            ], 401);
        }

        if (!$user->hasPermission($permission)) {
            return response()->json([
                'error' => 'Permission insuffisante',
                'required' => $permission,
                'user_permissions' => $user->permissions->pluck('slug')
            ], 403);
        }

        return $next($request);
    }
}

// Usage dans routes
Route::middleware(['auth:api', 'permission:validate:dossiers'])
    ->post('/dossiers/{id}/valider', [DossierController::class, 'valider']);
```

**User Model Methods:**

```php
// app/Models/User.php
trait HasPermissions
{
    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function permissions()
    {
        return $this->role->permissions();
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->role->slug === 'super-admin') {
            return true; // Super admin has all permissions
        }

        return $this->permissions()
            ->where('slug', $permission)
            ->exists();
    }

    public function can(string $action, string $resource): bool
    {
        return $this->hasPermission("{$action}:{$resource}");
    }

    public function canManage(string $resource): bool
    {
        return $this->hasPermission("manage:{$resource}");
    }
}
```

### 8.3 Sécurisation des Données

**8.3.1 Chiffrement des Données Sensibles**

```php
// app/Models/Paiement.php
use Illuminate\Database\Eloquent\Casts\Attribute;

protected $casts = [
    'metadata' => 'encrypted:array',  // Auto-encrypt metadata JSON
];

// Pour données spécifiques
protected function cardNumber(): Attribute
{
    return Attribute::make(
        get: fn($value) => decrypt($value),
        set: fn($value) => encrypt($value),
    );
}
```

**8.3.2 Protection CSRF (pour API avec session)**

```php
// config/sanctum.php (si utilisation Sanctum)
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
    '%s%s',
    'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
    env('APP_URL') ? ','.parse_url(env('APP_URL'), PHP_URL_HOST) : ''
))),
```

**8.3.3 Rate Limiting**

```php
// app/Http/Kernel.php
protected $middlewareGroups = [
    'api' => [
        'throttle:api',  // 60 requests/minute par défaut
        \Illuminate\Routing\Middleware\SubstituteBindings::class,
    ],
];

// Routes spécifiques avec limites custom
Route::middleware(['throttle:10,1'])->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink']);
});

// Rate limiting par tenant
Route::middleware(['throttle:tenant'])->group(function () {
    // Custom throttle logic based on plan
});
```

**Custom Tenant-Based Throttle:**

```php
// app/Http/Middleware/TenantRateLimiter.php
use Illuminate\Cache\RateLimiter;

class TenantRateLimiter
{
    protected $limiter;

    public function __construct(RateLimiter $limiter)
    {
        $this->limiter = $limiter;
    }

    public function handle($request, Closure $next)
    {
        $tenant = app('tenant');
        $plan = $tenant->plan;

        // Rate limit basé sur le plan
        $maxAttempts = match($plan->slug) {
            'basic' => 100,
            'pro' => 500,
            'enterprise' => 2000,
            default => 60
        };

        $key = 'tenant:' . $tenant->id . ':api-calls';

        if ($this->limiter->tooManyAttempts($key, $maxAttempts)) {
            return response()->json([
                'error' => 'Quota API dépassé pour ce mois',
                'limit' => $maxAttempts,
                'reset_at' => $this->limiter->availableIn($key)
            ], 429);
        }

        $this->limiter->hit($key, 3600); // 1 hour window

        $response = $next($request);

        // Headers de rate limiting
        $response->headers->set('X-RateLimit-Limit', $maxAttempts);
        $response->headers->set('X-RateLimit-Remaining',
            max(0, $maxAttempts - $this->limiter->attempts($key))
        );

        return $response;
    }
}
```

**8.3.4 SQL Injection Prevention**

```php
// ✅ GOOD - Eloquent ORM (auto-escaped)
$etudiants = Etudiant::where('filiere_id', $request->filiere_id)
    ->where('statut', 'actif')
    ->get();

// ✅ GOOD - Query Builder with bindings
$results = DB::select('SELECT * FROM etudiants WHERE filiere_id = ?', [$filiere_id]);

// ❌ BAD - Raw query with concatenation (NEVER DO THIS)
$results = DB::select("SELECT * FROM etudiants WHERE filiere_id = $filiere_id");
```

**8.3.5 XSS Prevention**

```php
// Laravel Blade auto-escapes {{ }}
// Vue/React handle escaping automatically

// API Response - déjà JSON encoded (safe)
return response()->json([
    'nom' => $etudiant->nom,  // Auto-escaped in JSON
]);

// Si besoin de HTML sanitization
use HTMLPurifier;

$cleanHtml = HTMLPurifier::clean($userInput);
```

**8.3.6 CORS Configuration**

```php
// config/cors.php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'https://ucad.deverp.sn',
        'https://ugb.deverp.sn',
        'https://*.deverp.sn',  // Wildcard pour tous les tenants
    ],

    'allowed_origins_patterns' => [
        '/^https:\/\/.*\.deverp\.sn$/',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
    ],

    'max_age' => 86400,  // 24 hours

    'supports_credentials' => true,
];
```

### 8.4 Audit Trail (Historique Actions)

```php
// app/Observers/AuditObserver.php
class AuditObserver
{
    public function created($model)
    {
        $this->logAction('created', $model);
    }

    public function updated($model)
    {
        $this->logAction('updated', $model, [
            'changes' => $model->getChanges(),
            'original' => $model->getOriginal(),
        ]);
    }

    public function deleted($model)
    {
        $this->logAction('deleted', $model);
    }

    protected function logAction($action, $model, $details = [])
    {
        HistoriqueAction::create([
            'etablissement_id' => app('etablissement_id'),
            'user_id' => auth()->id(),
            'action' => $action,
            'ressource' => get_class($model),
            'ressource_id' => $model->id,
            'details' => array_merge($details, [
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'url' => request()->fullUrl(),
                'method' => request()->method(),
            ]),
        ]);
    }
}

// Register observers
Etudiant::observe(AuditObserver::class);
Paiement::observe(AuditObserver::class);
Inscription::observe(AuditObserver::class);
```

---

## 9. Migration et Déploiement

### 9.1 Stratégie de Migration des Données Existantes

**Phase 1: Backup Complet**

```bash
# Dump PostgreSQL complet
pg_dump -h localhost -U deverp_user -d deverp_db > backup_pre_migration_$(date +%Y%m%d).sql

# Backup fichiers Cloudinary (si applicable)
# Export list of public_ids
```

**Phase 2: Ajout Colonne `etablissement_id`**

```php
// Migration: add_etablissement_id_to_all_tables.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $tables = [
        'users', 'inscriptions', 'etudiants', 'dossiers', 'documents',
        'paiements', 'lignes_paiement', 'formations', 'filieres',
        'departements', 'cours', 'notes', 'evaluations', 'tuteurs',
        // ... toutes les tables tenant-scoped
    ];

    public function up()
    {
        // 1. Créer table etablissements d'abord
        Schema::create('etablissements', function (Blueprint $table) {
            $table->id();
            $table->string('nom');
            $table->string('domaine')->unique();
            $table->string('email');
            // ... autres colonnes
            $table->timestamps();
            $table->softDeletes();
        });

        // 2. Créer premier établissement (migration existante)
        DB::table('etablissements')->insert([
            'nom' => 'Établissement Principal',
            'domaine' => env('DEFAULT_TENANT_DOMAIN', 'main.deverp.sn'),
            'email' => env('DEFAULT_TENANT_EMAIL', 'contact@deverp.sn'),
            'status' => 'actif',
            'actif' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $etablissement_id = DB::table('etablissements')->first()->id;

        // 3. Ajouter colonne etablissement_id à toutes les tables
        foreach ($this->tables as $table) {
            if (!Schema::hasColumn($table, 'etablissement_id')) {
                Schema::table($table, function (Blueprint $table) use ($etablissement_id) {
                    $table->unsignedBigInteger('etablissement_id')
                        ->nullable()  // Nullable temporairement pour migration
                        ->after('id');

                    $table->foreign('etablissement_id')
                        ->references('id')
                        ->on('etablissements')
                        ->onDelete('cascade');

                    $table->index('etablissement_id');
                });

                // 4. Populate avec établissement par défaut
                DB::table($table)->update(['etablissement_id' => $etablissement_id]);

                // 5. Rendre NOT NULL après population
                Schema::table($table, function (Blueprint $table) {
                    $table->unsignedBigInteger('etablissement_id')
                        ->nullable(false)
                        ->change();
                });
            }
        }

        // 6. Ajouter index composites pour performance
        Schema::table('inscriptions', function (Blueprint $table) {
            $table->index(['etablissement_id', 'statut']);
            $table->index(['etablissement_id', 'annee_academique']);
        });

        Schema::table('etudiants', function (Blueprint $table) {
            $table->unique(['etablissement_id', 'matricule']);
            $table->index(['etablissement_id', 'filiere_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique(['etablissement_id', 'email']);
            $table->unique(['etablissement_id', 'login']);
        });
    }

    public function down()
    {
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropForeign(['etablissement_id']);
                $table->dropColumn('etablissement_id');
            });
        }

        Schema::dropIfExists('etablissements');
    }
};
```

**Phase 3: Seeders pour Données de Test**

```php
// database/seeders/MultiTenantSeeder.php
class MultiTenantSeeder extends Seeder
{
    public function run()
    {
        // Créer 3 établissements de test
        $etablissements = [
            [
                'nom' => 'Université Cheikh Anta Diop',
                'domaine' => 'ucad.deverp.sn',
                'email' => 'contact@ucad.sn',
                'plan_id' => 2,  // Plan Pro
            ],
            [
                'nom' => 'Université Gaston Berger',
                'domaine' => 'ugb.deverp.sn',
                'email' => 'contact@ugb.sn',
                'plan_id' => 2,
            ],
            [
                'nom' => 'ESP Dakar',
                'domaine' => 'esp.deverp.sn',
                'email' => 'contact@esp.sn',
                'plan_id' => 1,  // Plan Basic
            ],
        ];

        foreach ($etablissements as $etabData) {
            $etablissement = Etablissement::create($etabData);

            // Créer admin pour chaque établissement
            $admin = User::create([
                'etablissement_id' => $etablissement->id,
                'nom' => 'Admin',
                'prenom' => $etablissement->nom,
                'email' => "admin@{$etablissement->domaine}",
                'login' => "admin@{$etablissement->domaine}",
                'password' => Hash::make('password123'),
                'role_id' => 1,  // Admin role
                'actif' => true,
            ]);

            // Créer formations types
            $this->seedFormations($etablissement->id);

            // Créer étudiants de test
            $this->seedEtudiants($etablissement->id, 50);
        }
    }

    protected function seedFormations($etablissement_id)
    {
        $departement = Departement::create([
            'etablissement_id' => $etablissement_id,
            'nom' => 'Sciences et Technologies',
            'code' => 'ST',
        ]);

        $filiere = Filiere::create([
            'etablissement_id' => $etablissement_id,
            'departement_id' => $departement->id,
            'nom' => 'Informatique',
            'code' => 'INFO',
        ]);

        Formation::create([
            'etablissement_id' => $etablissement_id,
            'filiere_id' => $filiere->id,
            'departement_id' => $departement->id,
            'nom' => 'Licence Informatique',
            'code' => 'L-INFO',
            'duree_annees' => 3,
        ]);
    }

    protected function seedEtudiants($etablissement_id, $count)
    {
        for ($i = 0; $i < $count; $i++) {
            // Logique création étudiant...
        }
    }
}
```

### 9.2 Déploiement Continu (CI/CD)

**GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy devERP

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: deverp_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          extensions: mbstring, pdo, pdo_pgsql, redis
          coverage: xdebug

      - name: Install dependencies
        run: |
          cd deverp_back_gestion_ecole
          composer install --no-interaction --prefer-dist

      - name: Copy .env
        run: |
          cd deverp_back_gestion_ecole
          cp .env.example .env
          php artisan key:generate

      - name: Run migrations
        run: |
          cd deverp_back_gestion_ecole
          php artisan migrate --force

      - name: Run tests
        run: |
          cd deverp_back_gestion_ecole
          php artisan test --coverage --min=80

      - name: Code quality checks
        run: |
          cd deverp_back_gestion_ecole
          ./vendor/bin/phpstan analyse
          ./vendor/bin/php-cs-fixer fix --dry-run --diff

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to staging
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/deverp-staging
            git pull origin staging
            composer install --no-dev --optimize-autoloader
            php artisan migrate --force
            php artisan config:cache
            php artisan route:cache
            php artisan view:cache
            php artisan queue:restart
            sudo systemctl reload php8.2-fpm

      - name: Run smoke tests
        run: |
          curl -f https://staging.deverp.sn/api/health || exit 1

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://deverp.sn

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Build Docker image
        run: |
          docker build -t deverp:${{ github.sha }} .
          docker tag deverp:${{ github.sha }} deverp:latest

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push deverp:${{ github.sha }}
          docker push deverp:latest

      - name: Deploy to production (Blue-Green)
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/deverp-prod

            # Pull new image
            docker-compose pull

            # Run migrations (safe, idempotent)
            docker-compose run --rm app php artisan migrate --force

            # Blue-Green: Start new containers
            docker-compose up -d --scale app=2 --no-recreate

            # Wait for health check
            sleep 10
            curl -f https://deverp.sn/api/health || exit 1

            # Stop old containers
            docker-compose up -d --scale app=2 --remove-orphans

            # Clear caches
            docker-compose exec app php artisan config:cache
            docker-compose exec app php artisan route:cache
            docker-compose exec app php artisan queue:restart

      - name: Rollback on failure
        if: failure()
        run: |
          echo "Deployment failed, rolling back..."
          # Rollback logic here

      - name: Notify team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 9.3 Configuration Serveur Production

**Nginx Configuration:**

```nginx
# /etc/nginx/sites-available/deverp-multi-tenant
map $http_host $tenant_domain {
    ~^(?<tenant>.+)\.deverp\.sn$ $tenant;
    default "";
}

# Catch-all for all tenant subdomains
server {
    listen 443 ssl http2;
    server_name *.deverp.sn;

    ssl_certificate /etc/letsencrypt/live/deverp.sn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deverp.sn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/deverp/public;
    index index.php;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;
    limit_req zone=api_limit burst=20 nodelay;

    # Logs per tenant
    access_log /var/log/nginx/$tenant_domain-access.log;
    error_log /var/log/nginx/$tenant_domain-error.log;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param TENANT_DOMAIN $tenant_domain;
        include fastcgi_params;

        # Timeouts
        fastcgi_read_timeout 300;
        fastcgi_send_timeout 300;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Admin portal (separate domain)
server {
    listen 443 ssl http2;
    server_name admin.deverp.sn;

    ssl_certificate /etc/letsencrypt/live/admin.deverp.sn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.deverp.sn/privkey.pem;

    root /var/www/deverp-admin/public;

    # Restrict access to known IPs (optional)
    # allow 41.203.x.x;
    # deny all;

    # Rest similar to above...
}
```

**Supervisor (Queue Workers):**

```ini
; /etc/supervisor/conf.d/deverp-worker.conf
[program:deverp-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/deverp/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=8
redirect_stderr=true
stdout_logfile=/var/www/deverp/storage/logs/worker.log
stopwaitsecs=3600

[program:deverp-scheduler]
command=/bin/sh -c "while [ true ]; do (php /var/www/deverp/artisan schedule:run --verbose --no-interaction &); sleep 60; done"
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/www/deverp/storage/logs/scheduler.log
```

**Crontab (Laravel Scheduler):**

```bash
# /etc/cron.d/deverp
* * * * * www-data cd /var/www/deverp && php artisan schedule:run >> /dev/null 2>&1
```

---

## 10. Plan de Mise en Œuvre

### 10.1 Timeline (12 Semaines)

```
┌──────────────────────────────────────────────────────────────────┐
│              PLAN DE MISE EN ŒUVRE - 12 SEMAINES                  │
└──────────────────────────────────────────────────────────────────┘

SEMAINES 1-2: FONDATIONS MULTI-TENANT
├─ Création table etablissements
├─ Migration ajout etablissement_id à toutes les tables
├─ Implémentation TenantResolver Middleware
├─ Implémentation Global Tenant Scope
├─ Trait Tenantable sur tous les models
├─ Tests unitaires isolation tenant
└─ Documentation architecture

SEMAINES 3-4: RBAC & SÉCURITÉ
├─ Création tables roles et permissions
├─ Implémentation système RBAC
├─ Middleware CheckPermission
├─ Migration données utilisateurs existants
├─ Configuration Laravel Passport
├─ Tests d'authentification multi-tenant
├─ Rate limiting par plan
└─ Audit trail (HistoriqueAction)

SEMAINES 5-6: SUPER-ADMIN PORTAL
├─ Création interface super-admin (React)
├─ API endpoints gestion établissements
├─ Création/activation/suspension établissements
├─ Gestion plans d'abonnement
├─ Dashboard statistiques globales
├─ Monitoring usage par tenant
└─ Tests E2E super-admin

SEMAINES 7-8: CONFIGURATION PAR TENANT
├─ Système config dynamique (JSON)
├─ Branding personnalisé (logo, couleurs)
├─ Configuration email SMTP par tenant
├─ Configuration paiement par tenant
├─ Templates emails personnalisables
├─ Générateur sous-domaine automatique
└─ Tests configuration

SEMAINES 9-10: OPTIMISATION & PERFORMANCE
├─ Mise en cache Redis par tenant
├─ Optimisation queries N+1
├─ Index BDD pour performance
├─ CDN Cloudinary pour assets
├─ Compression Gzip
├─ Load testing (1000 requêtes/sec)
├─ Monitoring New Relic/Datadog
└─ Documentation performance

SEMAINE 11: MIGRATION DONNÉES PRODUCTION
├─ Backup complet BDD existante
├─ Exécution migrations en prod
├─ Création établissement initial
├─ Migration données existantes
├─ Tests intégrité données
├─ Rollback plan si besoin
└─ Formation équipe

SEMAINE 12: DÉPLOIEMENT & MONITORING
├─ Déploiement production
├─ Configuration Nginx multi-tenant
├─ SSL wildcard (*.deverp.sn)
├─ Configuration queue workers
├─ Setup monitoring (Sentry, logs)
├─ Documentation ops
├─ Formation support client
└─ Go-live 🚀
```

### 10.2 Checklist Pré-Déploiement

```
┌──────────────────────────────────────────────────────────────────┐
│              CHECKLIST PRÉ-DÉPLOIEMENT PRODUCTION                 │
└──────────────────────────────────────────────────────────────────┘

□ INFRASTRUCTURE
  □ Serveurs provisionnés (2x app servers, 1x DB primary, 1x DB replica)
  □ Load balancer configuré (Nginx)
  □ Redis cluster configuré
  □ SSL wildcard certificate installé (*.deverp.sn)
  □ Domaines DNS configurés (A records)
  □ Firewall rules appliquées
  □ Backup automatique configuré

□ BASE DE DONNÉES
  □ PostgreSQL 15+ installé
  □ Migrations testées sur staging
  □ Seeders de test validés
  □ Index BDD créés
  □ Backup pré-migration effectué
  □ Réplication primary-replica configurée

□ APPLICATION
  □ .env production configuré
  □ APP_DEBUG=false
  □ APP_ENV=production
  □ Clés API configurées (Cloudinary, Wave, Orange Money)
  □ SMTP configuré
  □ Queue workers configurés (Supervisor)
  □ Laravel Scheduler configuré (cron)
  □ Logs rotation configurée

□ SÉCURITÉ
  □ OAuth2 keys générées (Passport)
  □ JWT secrets configurés
  □ Rate limiting activé
  □ CORS configuré correctement
  □ CSRF protection activée
  □ SQL injection tests passés
  □ XSS protection vérifiée
  □ Vulnerability scan effectué

□ TESTS
  □ Tests unitaires: 100% pass
  □ Tests d'intégration: pass
  □ Tests E2E: pass
  □ Load testing: 1000 req/sec OK
  □ Smoke tests production: pass
  □ Rollback procedure testée

□ MONITORING
  □ Sentry configuré (error tracking)
  □ Logs centralisés (ELK stack / CloudWatch)
  □ APM configuré (New Relic / Datadog)
  □ Health check endpoint: /api/health
  □ Alertes configurées (Slack/Email)

□ DOCUMENTATION
  □ README à jour
  □ API documentation (Swagger/Postman)
  □ Guide déploiement
  □ Guide rollback
  □ Runbook incidents
  □ Formation équipe effectuée

□ LEGAL & COMPLIANCE
  □ CGU/CGV validées
  □ Politique de confidentialité
  □ RGPD compliance (si applicable)
  □ Contrats SLA définis
  □ Support client prêt
```

### 10.3 Équipe Requise

```
┌──────────────────────────────────────────────────────────────────┐
│                        ÉQUIPE PROJET                              │
└──────────────────────────────────────────────────────────────────┘

DÉVELOPPEMENT
├─ 2x Backend Developers (Laravel, PostgreSQL, Redis)
├─ 2x Frontend Developers (React, Next.js, Tailwind)
├─ 1x DevOps Engineer (Nginx, Docker, CI/CD)
└─ 1x QA Engineer (Tests, Load testing)

ARCHITECTURE & DESIGN
├─ 1x Solution Architect (Lead technique)
└─ 1x UX/UI Designer (Portails admin)

PRODUCT & BUSINESS
├─ 1x Product Owner (Priorisation features)
├─ 1x Business Analyst (Spécifications)
└─ 1x Customer Success (Onboarding clients)

SUPPORT
├─ 2x Support Engineers (Helpdesk)
└─ 1x Documentation Writer
```

---

## 11. Conclusion et Prochaines Étapes

### 11.1 Résumé de la Transformation SaaS

Ce document fournit une modélisation complète pour transformer devERP en une plateforme SaaS multi-tenant robuste et scalable. Les éléments clés incluent:

1. **Architecture Multi-Tenant** - Single Database avec isolation par `etablissement_id`
2. **Modèle de Données ERD** - 30+ tables avec relations claires
3. **API RESTful Complète** - 100+ endpoints documentés
4. **Sécurité RBAC** - Système de permissions granulaire
5. **Performance & Scalabilité** - Cache Redis, CDN, load balancing
6. **Migration Sans Interruption** - Plan step-by-step pour données existantes
7. **CI/CD Automatisé** - GitHub Actions, tests, déploiement blue-green

### 11.2 Prochaines Étapes Immédiates

**Action 1:** Réviser et valider ce document avec l'équipe technique et métier

**Action 2:** Créer backlog produit détaillé dans Jira/Trello/Linear

**Action 3:** Setup environnement staging pour tests multi-tenant

**Action 4:** Commencer Semaine 1 (Fondations Multi-Tenant) après validation

**Action 5:** Configurer monitoring dès le début (logs, métriques, alertes)

### 11.3 Ressources Complémentaires

**Documentation Laravel:**
- https://laravel.com/docs/11.x/passport
- https://laravel.com/docs/11.x/authorization

**Multi-Tenancy Resources:**
- https://tenancy.dev/ (Laravel package)
- https://github.com/spatie/laravel-multitenancy

**API Design:**
- https://restfulapi.net/
- https://swagger.io/specification/

**PostgreSQL Performance:**
- https://use-the-index-luke.com/
- https://www.postgresql.org/docs/current/indexes.html

---

**FIN DU DOCUMENT DE MODÉLISATION**

Pour toute question ou clarification, contactez l'équipe technique à dev@deverp.sn
