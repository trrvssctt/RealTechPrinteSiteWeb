import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : RealTech
// Nodes   : 34  |  Connections: 17
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookEvenements                  webhook                    
// RouteurEvenements                  switch                     
// FormaterVente                      set                        
// FormaterCommande                   set                        
// FormaterSortieStock                set                        
// FormaterAnnulation                 set                        
// Cron22h00Rapport                   scheduleTrigger            
// GenererRapport                     httpRequest                
// TelechargerRapport                 httpRequest                
// EnvoyerRapportEmail                gmail                      [creds]
// WebhookAgentChat                   webhook                    
// AgentIaPanelAdmin                  agent                      [AI]
// OutilStatistiques                  toolHttpRequest            [ai_tool]
// OutilEmployes                      toolHttpRequest            [ai_tool]
// OutilVentes                        toolHttpRequest            [ai_tool]
// OutilStock                         toolHttpRequest            [ai_tool]
// OutilTopProduits                   toolHttpRequest            [ai_tool]
// OutilClients                       toolHttpRequest            [ai_tool]
// RepondreAgent                      respondToWebhook           
// WhatsappEntrant                    webhook                    
// VerifierAdmin                      if                         
// AgentIaWhatsapp                    agent                      [AI]
// RepondreWhatsapp                   httpRequest                
// DeepseekChatModel                  lmChatDeepSeek             [creds] [ai_languageModel]
// PostgresChatMemory                 memoryPostgresChat         [creds] [ai_memory]
// DeepseekChatModel1                 lmChatDeepSeek             [creds] [ai_languageModel]
// WhatsappVente                      httpRequest                
// WhatsappCommande                   httpRequest                
// WhatsappStock                      httpRequest                
// WhatsappAnnulation                 httpRequest                
// SendAMessage                       gmail                      [creds]
// SendAMessage1                      gmail                      [creds]
// SendAMessage2                      gmail                      [creds]
// SendAMessage3                      gmail                      [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookEvenements
//    → RouteurEvenements
//      → FormaterVente
//        → SendAMessage
//     .out(1) → FormaterCommande
//        → SendAMessage1
//     .out(2) → FormaterSortieStock
//        → SendAMessage2
//     .out(3) → FormaterAnnulation
//        → SendAMessage3
// Cron22h00Rapport
//    → GenererRapport
//      → TelechargerRapport
//        → EnvoyerRapportEmail
// WebhookAgentChat
//    → AgentIaPanelAdmin
//      → RepondreAgent
// WhatsappEntrant
//    → VerifierAdmin
//      → AgentIaWhatsapp
//        → RepondreWhatsapp
//
// AI CONNECTIONS
// AgentIaPanelAdmin.uses({ ai_languageModel: DeepseekChatModel, ai_memory: PostgresChatMemory, ai_tool: [OutilStatistiques, OutilEmployes, OutilVentes, OutilStock, OutilTopProduits, OutilClients] })
// AgentIaWhatsapp.uses({ ai_languageModel: DeepseekChatModel1 })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "WBzmPIcvQCOvWU2S",
    name: "RealTech",
    active: false,
    isArchived: false,
    settings: { executionOrder: "v1", binaryMode: "separate", availableInMCP: false, errorWorkflow: "", saveManualExecutions: true, callerPolicy: "workflowsFromSameOwner" }
})
export class RealtechWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "887f1f89-813a-4870-8503-a57f29cfc6d7",
        webhookId: "rt-events-001",
        name: "Webhook Événements",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [-416, 496]
    })
    WebhookEvenements = {
        path: "rt-events-001",
        httpMethod: "POST",
        responseMode: "onReceived",
        options: {}
    };

    @node({
        id: "6f9248c6-205a-47e7-8d42-d52a9dc95624",
        name: "Routeur Événements",
        type: "n8n-nodes-base.switch",
        version: 3,
        position: [160, 288]
    })
    RouteurEvenements = {
        mode: "rules",
        rules: {
            values: [
                {
                    outputKey: "0",
                    conditions: {
                        options: {
                            caseSensitive: false,
                            leftValue: "",
                            typeValidation: "loose"
                        },
                        conditions: [
                            {
                                id: "cond-vente",
                                leftValue: "={{ $json.body.type }}",
                                rightValue: "vente",
                                operator: {
                                    type: "string",
                                    operation: "equals"
                                }
                            }
                        ],
                        combinator: "and"
                    },
                    renameOutput: true,
                    outputName: "Vente"
                },
                {
                    outputKey: "1",
                    conditions: {
                        options: {
                            caseSensitive: false,
                            leftValue: "",
                            typeValidation: "loose"
                        },
                        conditions: [
                            {
                                id: "cond-commande",
                                leftValue: "={{ $json.body.type }}",
                                rightValue: "commande",
                                operator: {
                                    type: "string",
                                    operation: "equals"
                                }
                            }
                        ],
                        combinator: "and"
                    },
                    renameOutput: true,
                    outputName: "Commande"
                },
                {
                    outputKey: "2",
                    conditions: {
                        options: {
                            caseSensitive: false,
                            leftValue: "",
                            typeValidation: "loose"
                        },
                        conditions: [
                            {
                                id: "cond-stock",
                                leftValue: "={{ $json.body.type }}",
                                rightValue: "sortie_stock",
                                operator: {
                                    type: "string",
                                    operation: "equals"
                                }
                            }
                        ],
                        combinator: "and"
                    },
                    renameOutput: true,
                    outputName: "Sortie Stock"
                },
                {
                    outputKey: "3",
                    conditions: {
                        options: {
                            caseSensitive: false,
                            leftValue: "",
                            typeValidation: "loose"
                        },
                        conditions: [
                            {
                                id: "cond-annulation",
                                leftValue: "={{ $json.body.type }}",
                                rightValue: "annulation",
                                operator: {
                                    type: "string",
                                    operation: "equals"
                                }
                            }
                        ],
                        combinator: "and"
                    },
                    renameOutput: true,
                    outputName: "Annulation"
                }
            ]
        },
        options: {}
    };

    @node({
        id: "323262b9-c309-4ef3-aa32-037002b37f37",
        name: "Formater Vente",
        type: "n8n-nodes-base.set",
        version: 3.4,
        position: [672, 160]
    })
    FormaterVente = {
        mode: "manual",
        fields: {
            values: [
                {
                    name: "id_vente",
                    type: "string",
                    value: "={{ $json.body.data.id }}"
                },
                {
                    name: "client",
                    type: "string",
                    value: "={{ $json.body.data.client_nom ?? $json.body.data.client ?? 'Client inconnu' }}"
                },
                {
                    name: "produits",
                    type: "string",
                    value: "={{ $json.body.data.produits ?? $json.body.data.description ?? '-' }}"
                },
                {
                    name: "montant_total",
                    type: "string",
                    value: "={{ $json.body.data.montant_total ?? $json.body.data.total ?? '0' }}"
                },
                {
                    name: "employe",
                    type: "string",
                    value: "={{ $json.body.data.employe ?? $json.body.data.vendeur ?? 'N/A' }}"
                },
                {
                    name: "date",
                    type: "string",
                    value: "={{ $now.setZone('Africa/Dakar').toFormat('dd/MM/yyyy HH:mm') }}"
                }
            ]
        },
        options: {}
    };

    @node({
        id: "823dc5e3-f12b-4d56-9a70-28e7b7fa638f",
        name: "Formater Commande",
        type: "n8n-nodes-base.set",
        version: 3.4,
        position: [672, 304]
    })
    FormaterCommande = {
        mode: "manual",
        fields: {
            values: [
                {
                    name: "id_commande",
                    type: "string",
                    value: "={{ $json.body.data.id }}"
                },
                {
                    name: "client",
                    type: "string",
                    value: "={{ $json.body.data.client_nom ?? $json.body.data.client ?? 'Client inconnu' }}"
                },
                {
                    name: "produits",
                    type: "string",
                    value: "={{ $json.body.data.produits ?? $json.body.data.description ?? '-' }}"
                },
                {
                    name: "montant_total",
                    type: "string",
                    value: "={{ $json.body.data.montant_total ?? $json.body.data.total ?? '0' }}"
                },
                {
                    name: "statut",
                    type: "string",
                    value: "={{ $json.body.data.statut ?? 'En attente' }}"
                },
                {
                    name: "date",
                    type: "string",
                    value: "={{ $now.setZone('Africa/Dakar').toFormat('dd/MM/yyyy HH:mm') }}"
                }
            ]
        },
        options: {}
    };

    @node({
        id: "3947cf16-7f87-4066-a950-a20863f94666",
        name: "Formater Sortie Stock",
        type: "n8n-nodes-base.set",
        version: 3.4,
        position: [672, 448]
    })
    FormaterSortieStock = {
        mode: "manual",
        fields: {
            values: [
                {
                    name: "id_mouvement",
                    type: "string",
                    value: "={{ $json.body.data.id }}"
                },
                {
                    name: "produit",
                    type: "string",
                    value: "={{ $json.body.data.produit_nom ?? $json.body.data.produit ?? 'Produit inconnu' }}"
                },
                {
                    name: "quantite",
                    type: "string",
                    value: "={{ $json.body.data.quantite }}"
                },
                {
                    name: "stock_restant",
                    type: "string",
                    value: "={{ $json.body.data.stock_restant ?? $json.body.data.stock_apres ?? 'N/A' }}"
                },
                {
                    name: "motif",
                    type: "string",
                    value: "={{ $json.body.data.motif ?? $json.body.data.raison ?? 'Non précisé' }}"
                },
                {
                    name: "employe",
                    type: "string",
                    value: "={{ $json.body.data.employe ?? 'N/A' }}"
                },
                {
                    name: "date",
                    type: "string",
                    value: "={{ $now.setZone('Africa/Dakar').toFormat('dd/MM/yyyy HH:mm') }}"
                }
            ]
        },
        options: {}
    };

    @node({
        id: "716b4544-8ad1-4d9c-851e-53a033d77a66",
        name: "Formater Annulation",
        type: "n8n-nodes-base.set",
        version: 3.4,
        position: [672, 592]
    })
    FormaterAnnulation = {
        mode: "manual",
        fields: {
            values: [
                {
                    name: "id_ref",
                    type: "string",
                    value: "={{ $json.body.data.id }}"
                },
                {
                    name: "type_ref",
                    type: "string",
                    value: "={{ $json.body.data.type_ref ?? 'commande' }}"
                },
                {
                    name: "client",
                    type: "string",
                    value: "={{ $json.body.data.client_nom ?? $json.body.data.client ?? 'Client inconnu' }}"
                },
                {
                    name: "raison",
                    type: "string",
                    value: "={{ $json.body.data.raison ?? $json.body.data.motif ?? 'Non précisée' }}"
                },
                {
                    name: "montant",
                    type: "string",
                    value: "={{ $json.body.data.montant ?? $json.body.data.total ?? '0' }}"
                },
                {
                    name: "employe",
                    type: "string",
                    value: "={{ $json.body.data.employe ?? 'N/A' }}"
                },
                {
                    name: "date",
                    type: "string",
                    value: "={{ $now.setZone('Africa/Dakar').toFormat('dd/MM/yyyy HH:mm') }}"
                }
            ]
        },
        options: {}
    };

    @node({
        id: "d4bc105c-7a40-401f-a62d-f0efccf77267",
        name: "Cron 22h00 — Rapport",
        type: "n8n-nodes-base.scheduleTrigger",
        version: 1.2,
        position: [16, 976]
    })
    Cron22h00Rapport = {
        rule: {
            interval: [
                {
                    field: "cronExpression",
                    expression: "0 22 * * *"
                }
            ]
        }
    };

    @node({
        id: "16a350a2-f8dc-43bc-9305-1d7be222838f",
        name: "Générer Rapport",
        type: "n8n-nodes-base.httpRequest",
        version: 4.2,
        position: [432, 912]
    })
    GenererRapport = {
        method: "POST",
        url: "={{ $env.API_BASE_URL }}/api/rapports/generer",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: "Authorization",
                    value: "Bearer {{ $env.API_TOKEN }}"
                },
                {
                    name: "Content-Type",
                    value: "application/json"
                }
            ]
        },
        sendBody: true,
        bodyParameters: {
            parameters: [
                {
                    name: "date",
                    value: "={{ $now.setZone('Africa/Dakar').toFormat('yyyy-MM-dd') }}"
                }
            ]
        },
        options: {}
    };

    @node({
        id: "8ac49e5f-8a3e-41b0-8a24-67c0f8e5d0c1",
        name: "Télécharger Rapport",
        type: "n8n-nodes-base.httpRequest",
        version: 4.2,
        position: [736, 880]
    })
    TelechargerRapport = {
        method: "GET",
        url: "={{ $env.API_BASE_URL }}/api/rapports/{{ $json.rapport_id ?? $json.id }}/export?format=pdf",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: "Authorization",
                    value: "Bearer {{ $env.API_TOKEN }}"
                }
            ]
        },
        responseFormat: "file",
        options: {
            response: {
                response: {
                    responseFormat: "file",
                    outputPropertyName: "rapport_pdf"
                }
            }
        }
    };

    @node({
        id: "866bd23f-e058-4afc-b4d4-fc287b83aaba",
        webhookId: "9360edfa-6080-40d6-b353-c29c6844454d",
        name: "Envoyer Rapport Email",
        type: "n8n-nodes-base.gmail",
        version: 2.2,
        position: [1104, 976],
        credentials: {gmailOAuth2:{id:"zB8OzHLGuenMSZEo",name:"Gmail 09 Mars 2026"}}
    })
    EnvoyerRapportEmail = {
        operation: "send",
        sendTo: "diankaseydou52@gmail.com",
        subject: "={{ '📊 Rapport Journalier RealTech — ' + $now.setZone('Africa/Dakar').toFormat('dd/MM/yyyy') }}",
        message: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- EN-TÊTE -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">📊 Rapport Journalier</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:15px;">RealTech — {{ $now.setZone('Africa/Dakar').toFormat('EEEE dd MMMM yyyy') }}</p>
          </td>
        </tr>

        <!-- CORPS -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
              Bonjour,<br><br>
              Veuillez trouver ci-joint le rapport journalier automatique de RealTech généré à <strong>22h00</strong>.<br>
              Ce rapport couvre l'ensemble des activités de la journée du <strong>{{ $now.setZone('Africa/Dakar').toFormat('dd/MM/yyyy') }}</strong>.
            </p>

            <!-- RÉSUMÉ -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
              <tr>
                <td style="padding:8px 16px;border-left:4px solid #2563eb;">
                  <p style="margin:0;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Rapport inclus</p>
                  <p style="margin:4px 0 0;color:#111827;font-size:14px;font-weight:600;">Ventes · Commandes · Stock · Finances</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#374151;font-size:14px;">
              Le fichier PDF est joint à cet e-mail. Si la pièce jointe ne s'affiche pas, veuillez contacter l'administrateur.
            </p>
          </td>
        </tr>

        <!-- PIED DE PAGE -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              Ce message est généré automatiquement par le système RealTech · Ne pas répondre<br>
              {{ $now.setZone('Africa/Dakar').toFormat('dd/MM/yyyy à HH:mm') }} (heure de Dakar)
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        options: {
            attachmentsUi: {
                attachmentsBinary: [
                    {
                        property: "rapport_pdf"
                    }
                ]
            },
            appendAttribution: false
        }
    };

    @node({
        id: "cf81fe3e-a0a1-4772-9cbe-dbd3ae6211ce",
        webhookId: "rt-agent-001",
        name: "Webhook Agent Chat",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [-112, 1376]
    })
    WebhookAgentChat = {
        path: "rt-agent-001",
        options: {}
    };

    @node({
        id: "30aa094c-e463-4807-bdf3-955e0a1b2301",
        name: "Agent IA — Panel Admin",
        type: "@n8n/n8n-nodes-langchain.agent",
        version: 1,
        position: [576, 1232]
    })
    AgentIaPanelAdmin = {
        options: {}
    };

    @node({
        id: "40334f91-a119-492b-a142-6120f060c2b5",
        name: "Outil — Statistiques",
        type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
        version: 1,
        position: [624, 1696]
    })
    OutilStatistiques = {};

    @node({
        id: "d85fd5f1-f97f-48cb-8be9-0a3ec17d3aab",
        name: "Outil — Employés",
        type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
        version: 1,
        position: [800, 1696]
    })
    OutilEmployes = {};

    @node({
        id: "7da6df05-2699-4d0a-a091-9a884fd35771",
        name: "Outil — Ventes",
        type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
        version: 1,
        position: [976, 1696]
    })
    OutilVentes = {};

    @node({
        id: "31f7e6c9-a5d6-4db2-a567-4b5225810dfb",
        name: "Outil — Stock",
        type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
        version: 1,
        position: [1152, 1696]
    })
    OutilStock = {};

    @node({
        id: "77ada565-a9b3-4217-8eba-2a6a3ed21410",
        name: "Outil — Top Produits",
        type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
        version: 1,
        position: [1344, 1696]
    })
    OutilTopProduits = {};

    @node({
        id: "18ab6eff-528f-4a2d-b5af-6d7285e8fa98",
        name: "Outil — Clients",
        type: "@n8n/n8n-nodes-langchain.toolHttpRequest",
        version: 1,
        position: [1520, 1696]
    })
    OutilClients = {};

    @node({
        id: "7fbcee19-30db-45a7-8d96-7db16ad375dc",
        name: "Répondre Agent",
        type: "n8n-nodes-base.respondToWebhook",
        version: 1,
        position: [1680, 1360]
    })
    RepondreAgent = {
        options: {}
    };

    @node({
        id: "c50287bf-c310-4297-9085-28598b670eeb",
        webhookId: "rt-wa-incoming-001",
        name: "WhatsApp Entrant",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [16, 2240]
    })
    WhatsappEntrant = {
        path: "rt-wa-incoming-001",
        options: {}
    };

    @node({
        id: "61b9c318-82bd-4338-965b-0071f3c7d226",
        name: "Vérifier Admin",
        type: "n8n-nodes-base.if",
        version: 1,
        position: [416, 2128]
    })
    VerifierAdmin = {
        options: {}
    };

    @node({
        id: "3bfb90cf-3f60-415e-bf86-7b3182ca067f",
        name: "Agent IA — WhatsApp",
        type: "@n8n/n8n-nodes-langchain.agent",
        version: 1,
        position: [752, 2048]
    })
    AgentIaWhatsapp = {
        options: {}
    };

    @node({
        id: "ad5e7123-e8e7-4159-8545-8ff8c2e3c582",
        name: "Répondre WhatsApp",
        type: "n8n-nodes-base.httpRequest",
        version: 1,
        position: [1376, 2128]
    })
    RepondreWhatsapp = {
        method: "POST",
        options: {}
    };

    @node({
        id: "17b46b9e-cb4f-4e83-91f0-f2e2e5f082ff",
        name: "DeepSeek Chat Model",
        type: "@n8n/n8n-nodes-langchain.lmChatDeepSeek",
        version: 1,
        position: [144, 1744],
        credentials: {deepSeekApi:{id:"7xifHFmlSOW7XjwP",name:"DeepSeek 5 Mars 2026"}}
    })
    DeepseekChatModel = {
        options: {}
    };

    @node({
        id: "8721c6b4-0ae9-44cb-9101-d8705348c729",
        name: "Postgres Chat Memory",
        type: "@n8n/n8n-nodes-langchain.memoryPostgresChat",
        version: 1.3,
        position: [384, 1760],
        credentials: {postgres:{id:"AsQngpZJakTg3Vi0",name:"gestionapp_site_web_realtech"}}
    })
    PostgresChatMemory = {};

    @node({
        id: "3c50d362-3095-4f81-9675-c3dd0f8d2fde",
        name: "DeepSeek Chat Model1",
        type: "@n8n/n8n-nodes-langchain.lmChatDeepSeek",
        version: 1,
        position: [576, 2432],
        credentials: {deepSeekApi:{id:"7xifHFmlSOW7XjwP",name:"DeepSeek 5 Mars 2026"}}
    })
    DeepseekChatModel1 = {
        options: {}
    };

    @node({
        id: "9dfdc5bf-70a3-467d-a7f9-82b02d6e214a",
        name: "WhatsApp — Vente",
        type: "n8n-nodes-base.httpRequest",
        version: 4.4,
        position: [2448, -784]
    })
    WhatsappVente = {
        options: {}
    };

    @node({
        id: "49154081-1d6c-4503-bab8-7d82e0a12c9c",
        name: "WhatsApp — Commande",
        type: "n8n-nodes-base.httpRequest",
        version: 4.4,
        position: [2448, -544]
    })
    WhatsappCommande = {
        options: {}
    };

    @node({
        id: "9a6b4ab2-4b93-4e6d-9133-757a940739f6",
        name: "WhatsApp — Stock",
        type: "n8n-nodes-base.httpRequest",
        version: 4.4,
        position: [2464, -288]
    })
    WhatsappStock = {
        options: {}
    };

    @node({
        id: "e2aac1a4-2532-41d0-be2c-494a44fc24f8",
        name: "WhatsApp — Annulation",
        type: "n8n-nodes-base.httpRequest",
        version: 4.4,
        position: [2496, -64]
    })
    WhatsappAnnulation = {
        options: {}
    };

    @node({
        id: "7aa110e6-77cc-4db6-b0e3-436289a0d474",
        webhookId: "9360edfa-6080-40d6-b353-c29c6844454d",
        name: "Send a message",
        type: "n8n-nodes-base.gmail",
        version: 2.2,
        position: [1216, -176],
        credentials: {gmailOAuth2:{id:"zB8OzHLGuenMSZEo",name:"Gmail 09 Mars 2026"}}
    })
    SendAMessage = {
        operation: "send",
        sendTo: "diankaseydou52@gmail.com",
        subject: "={{ '🛍️ Nouvelle vente #' + $json.id_vente + ' — ' + $json.client + ' | RealTech' }}",
        message: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- EN-TÊTE VERT VENTE -->
        <tr>
          <td style="background:linear-gradient(135deg,#065f46 0%,#059669 100%);padding:28px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:8px;">🛍️</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Nouvelle Vente Enregistrée</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">RealTech · Notification automatique</p>
          </td>
        </tr>

        <!-- BADGE N° DE VENTE -->
        <tr>
          <td style="padding:24px 40px 0;text-align:center;">
            <span style="display:inline-block;background:#ecfdf5;color:#065f46;font-size:13px;font-weight:700;padding:6px 18px;border-radius:999px;letter-spacing:0.5px;">
              N° VENTE : #{{ $json.id_vente }}
            </span>
          </td>
        </tr>

        <!-- DÉTAILS -->
        <tr>
          <td style="padding:24px 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:38%;">👤 Client</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:600;">{{ $json.client }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">📦 Produits</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">{{ $json.produits }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">👷 Employé</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">{{ $json.employe }}</td>
              </tr>
              <tr>
                <td style="padding:16px 0 0;color:#6b7280;font-size:13px;">💰 Montant total</td>
                <td style="padding:16px 0 0;color:#059669;font-size:22px;font-weight:800;">{{ $json.montant_total }} FCFA</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PIED DE PAGE -->
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">{{ $json.date }} (heure de Dakar) · Généré automatiquement par RealTech</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        options: {
            appendAttribution: false
        }
    };

    @node({
        id: "820db651-0cd4-469b-8e74-2f1e61d75045",
        webhookId: "9360edfa-6080-40d6-b353-c29c6844454d",
        name: "Send a message1",
        type: "n8n-nodes-base.gmail",
        version: 2.2,
        position: [1248, 64],
        credentials: {gmailOAuth2:{id:"zB8OzHLGuenMSZEo",name:"Gmail 09 Mars 2026"}}
    })
    SendAMessage1 = {
        operation: "send",
        sendTo: "diankaseydou52@gmail.com",
        subject: "={{ '📦 Nouvelle commande #' + $json.id_commande + ' — ' + $json.client + ' | RealTech' }}",
        message: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- EN-TÊTE BLEU COMMANDE -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:28px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:8px;">📦</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Nouvelle Commande Reçue</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">RealTech · Notification automatique</p>
          </td>
        </tr>

        <!-- BADGE N° COMMANDE -->
        <tr>
          <td style="padding:24px 40px 0;text-align:center;">
            <span style="display:inline-block;background:#eff6ff;color:#1e40af;font-size:13px;font-weight:700;padding:6px 18px;border-radius:999px;letter-spacing:0.5px;">
              N° COMMANDE : #{{ $json.id_commande }}
            </span>
          </td>
        </tr>

        <!-- DÉTAILS -->
        <tr>
          <td style="padding:24px 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:38%;">👤 Client</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:600;">{{ $json.client }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">📋 Articles commandés</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">{{ $json.produits }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">🔖 Statut</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
                  <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:3px 12px;border-radius:999px;">{{ $json.statut }}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 0 0;color:#6b7280;font-size:13px;">💰 Montant total</td>
                <td style="padding:16px 0 0;color:#2563eb;font-size:22px;font-weight:800;">{{ $json.montant_total }} FCFA</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PIED DE PAGE -->
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">{{ $json.date }} (heure de Dakar) · Généré automatiquement par RealTech</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        options: {
            appendAttribution: false
        }
    };

    @node({
        id: "84f2381f-fa7f-4c38-a4bf-a60445398a96",
        webhookId: "9360edfa-6080-40d6-b353-c29c6844454d",
        name: "Send a message2",
        type: "n8n-nodes-base.gmail",
        version: 2.2,
        position: [1280, 352],
        credentials: {gmailOAuth2:{id:"zB8OzHLGuenMSZEo",name:"Gmail 09 Mars 2026"}}
    })
    SendAMessage2 = {
        operation: "send",
        sendTo: "diankaseydou52@gmail.com",
        subject: "={{ '📉 Sortie de stock — ' + $json.produit + ' (' + $json.quantite + ' unités) | RealTech' }}",
        message: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- EN-TÊTE ORANGE STOCK -->
        <tr>
          <td style="background:linear-gradient(135deg,#92400e 0%,#f59e0b 100%);padding:28px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:8px;">📉</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Mouvement de Stock</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">RealTech · Notification automatique</p>
          </td>
        </tr>

        <!-- BADGE PRODUIT -->
        <tr>
          <td style="padding:24px 40px 0;text-align:center;">
            <span style="display:inline-block;background:#fffbeb;color:#92400e;font-size:13px;font-weight:700;padding:6px 18px;border-radius:999px;letter-spacing:0.5px;">
              REF #{{ $json.id_mouvement }} · {{ $json.produit }}
            </span>
          </td>
        </tr>

        <!-- DÉTAILS -->
        <tr>
          <td style="padding:24px 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:38%;">📦 Produit</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:600;">{{ $json.produit }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">📤 Quantité sortie</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#dc2626;font-size:16px;font-weight:800;">−{{ $json.quantite }} unités</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">📊 Stock restant</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:15px;font-weight:700;">{{ $json.stock_restant }} unités</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">📝 Motif</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">{{ $json.motif }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0 0;color:#6b7280;font-size:13px;">👷 Employé</td>
                <td style="padding:12px 0 0;color:#374151;font-size:14px;">{{ $json.employe }}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PIED DE PAGE -->
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">{{ $json.date }} (heure de Dakar) · Généré automatiquement par RealTech</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        options: {
            appendAttribution: false
        }
    };

    @node({
        id: "161a7d51-af70-4b60-8235-7401112d4f7b",
        webhookId: "9360edfa-6080-40d6-b353-c29c6844454d",
        name: "Send a message3",
        type: "n8n-nodes-base.gmail",
        version: 2.2,
        position: [1104, 640],
        credentials: {gmailOAuth2:{id:"zB8OzHLGuenMSZEo",name:"Gmail 09 Mars 2026"}}
    })
    SendAMessage3 = {
        operation: "send",
        sendTo: "diankaseydou52@gmail.com",
        subject: "={{ '❌ Annulation #' + $json.id_ref + ' — ' + $json.client + ' | RealTech' }}",
        message: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- EN-TÊTE ROUGE ANNULATION -->
        <tr>
          <td style="background:linear-gradient(135deg,#7f1d1d 0%,#ef4444 100%);padding:28px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:8px;">❌</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Annulation Enregistrée</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">RealTech · Notification automatique</p>
          </td>
        </tr>

        <!-- BADGE RÉFÉRENCE -->
        <tr>
          <td style="padding:24px 40px 0;text-align:center;">
            <span style="display:inline-block;background:#fef2f2;color:#7f1d1d;font-size:13px;font-weight:700;padding:6px 18px;border-radius:999px;letter-spacing:0.5px;">
              ANNULATION {{ $json.type_ref | upper }} #{{ $json.id_ref }}
            </span>
          </td>
        </tr>

        <!-- DÉTAILS -->
        <tr>
          <td style="padding:24px 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:38%;">👤 Client</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:600;">{{ $json.client }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">🔖 Type</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;text-transform:capitalize;">{{ $json.type_ref }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">📝 Raison</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">{{ $json.raison }}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">👷 Traité par</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">{{ $json.employe }}</td>
              </tr>
              <tr>
                <td style="padding:16px 0 0;color:#6b7280;font-size:13px;">💸 Montant annulé</td>
                <td style="padding:16px 0 0;color:#ef4444;font-size:22px;font-weight:800;">{{ $json.montant }} FCFA</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ALERTE -->
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;">
              <p style="margin:0;color:#991b1b;font-size:13px;">
                ⚠️ <strong>Action requise :</strong> Vérifiez si un remboursement ou un réapprovisionnement est nécessaire suite à cette annulation.
              </p>
            </div>
          </td>
        </tr>

        <!-- PIED DE PAGE -->
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">{{ $json.date }} (heure de Dakar) · Généré automatiquement par RealTech</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
        options: {
            appendAttribution: false
        }
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.WebhookEvenements.out(0).to(this.RouteurEvenements.in(0));
        this.RouteurEvenements.out(0).to(this.FormaterVente.in(0));
        this.RouteurEvenements.out(1).to(this.FormaterCommande.in(0));
        this.RouteurEvenements.out(2).to(this.FormaterSortieStock.in(0));
        this.RouteurEvenements.out(3).to(this.FormaterAnnulation.in(0));
        this.FormaterVente.out(0).to(this.SendAMessage.in(0));
        this.FormaterCommande.out(0).to(this.SendAMessage1.in(0));
        this.FormaterSortieStock.out(0).to(this.SendAMessage2.in(0));
        this.FormaterAnnulation.out(0).to(this.SendAMessage3.in(0));
        this.Cron22h00Rapport.out(0).to(this.GenererRapport.in(0));
        this.GenererRapport.out(0).to(this.TelechargerRapport.in(0));
        this.TelechargerRapport.out(0).to(this.EnvoyerRapportEmail.in(0));
        this.WebhookAgentChat.out(0).to(this.AgentIaPanelAdmin.in(0));
        this.AgentIaPanelAdmin.out(0).to(this.RepondreAgent.in(0));
        this.WhatsappEntrant.out(0).to(this.VerifierAdmin.in(0));
        this.VerifierAdmin.out(0).to(this.AgentIaWhatsapp.in(0));
        this.AgentIaWhatsapp.out(0).to(this.RepondreWhatsapp.in(0));

        this.AgentIaPanelAdmin.uses({
            ai_languageModel: this.DeepseekChatModel.output,
            ai_memory: this.PostgresChatMemory.output,
            ai_tool: [this.OutilStatistiques.output, this.OutilEmployes.output, this.OutilVentes.output, this.OutilStock.output, this.OutilTopProduits.output, this.OutilClients.output]
        });
        this.AgentIaWhatsapp.uses({
            ai_languageModel: this.DeepseekChatModel1.output
        });
    }
}