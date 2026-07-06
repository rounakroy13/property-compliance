# 🏠 Property Compliance & Loan Validation AI Chatbot

An AI-powered Multi-Agent System for automated property compliance checking and loan validation, built with Google Cloud technologies.

![Property Compliance AI](https://img.shields.io/badge/AI-Multi--Agent%20System-blue)
![Google Cloud](https://img.shields.io/badge/Google%20Cloud-Vertex%20AI-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Node.js](https://img.shields.io/badge/Node.js-20+-green)

## 🎯 Overview

This solution addresses the complexity of property transactions by automating:
- **Property Ownership Verification** against land records
- **Legal Compliance Validation** (zoning, tax, environmental)
- **Fraud Detection** through document and transaction analysis
- **Loan Eligibility Assessment** with explainable AI decisions

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏠 **Property Verification** | Verify ownership, survey numbers, boundaries |
| 📋 **Compliance Checks** | Zoning, tax, environmental, municipal approvals |
| 🛡️ **Fraud Detection** | Document authenticity, ownership mismatches, suspicious patterns |
| 💰 **Loan Eligibility** | Calculate eligibility, EMI, LTV, FOIR |
| 🤖 **Explainable AI** | Transparent decisions with detailed reasoning |
| 💬 **Conversational UI** | Natural language chatbot interface |
| ⚡ **Real-time Processing** | Multi-agent parallel processing |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Interface (Chat)                       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                         Express Server                           │
│                    (REST API + WebSocket)                        │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                      Agent Orchestrator                          │
│              (Coordinates Multi-Agent Workflow)                  │
└───────┬──────────┬──────────┬──────────┬──────────┬─────────────┘
        │          │          │          │          │
   ┌────▼────┐ ┌───▼───┐ ┌───▼───┐ ┌────▼────┐ ┌───▼────┐
   │Property │ │Compli-│ │Fraud  │ │  Loan   │ │Decision│
   │Verifi-  │ │ance   │ │Detect-│ │Eligibi- │ │Agent   │
   │cation   │ │Agent  │ │ion    │ │lity     │ │(Gemini)│
   │Agent    │ │       │ │Agent  │ │Agent    │ │        │
   └────┬────┘ └───┬───┘ └───┬───┘ └────┬────┘ └───┬────┘
        │          │          │          │          │
        └──────────┴──────────┴──────────┴──────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     Data Layer (BigQuery)                        │
│   Land Records │ Tax Records │ Compliance Rules │ Loan Policies  │
└─────────────────────────────────────────────────────────────────┘
```

## 🤖 AI Agents

### 1. Property Verification Agent
- Verifies ownership against land records
- Validates survey numbers and boundaries
- Detects ownership conflicts
- Checks chain of title

### 2. Compliance Agent
- Zoning compliance verification
- Tax payment status check
- Environmental clearance validation
- Municipal approval verification
- Building regulation compliance

### 3. Fraud Detection Agent
- Document authenticity analysis
- Ownership consistency checks
- Transaction pattern analysis
- Price manipulation detection
- Multiple ownership claim detection

### 4. Loan Eligibility Agent
- Income eligibility assessment
- Credit score evaluation
- LTV (Loan-to-Value) calculation
- FOIR (Fixed Obligations to Income Ratio) analysis
- Employment stability assessment
- Age eligibility check

### 5. Decision Agent (Gemini-powered)
- Aggregates all agent results
- Generates explainable decisions
- Produces compliance reports
- Recommends corrective actions
- Calculates overall risk scores

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- Google Cloud account (for production)

### Installation

```bash
# Clone or navigate to the project
cd property-compliance-chatbot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Access the Application

Open your browser and navigate to:
- **Chat UI**: http://localhost:3000
- **API**: http://localhost:3000/api

## 📡 API Endpoints

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/session` | Create new chat session |
| GET | `/api/chat/session/:id` | Get session details |
| POST | `/api/chat/message` | Send message to chatbot |

### Verification Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/verify/property` | Run property verification |
| POST | `/api/verify/loan` | Run loan application workflow |
| POST | `/api/demo/verify` | Run demo with sample data |

### Agent Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | Get all agents info |
| POST | `/api/agent/:type` | Run specific agent |

## 💬 Chat Commands

Try these commands in the chatbot:

```
"Verify property 123/45/2024"
"Check loan eligibility"
"Run compliance check"
"Check for fraud"
"Run demo"
"Help"
```

## 🔧 Configuration

### Environment Variables

```env
# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Vertex AI
VERTEX_AI_MODEL=gemini-1.5-pro

# BigQuery
BIGQUERY_DATASET=property_compliance

# Server
PORT=3000
NODE_ENV=development
```

## 📊 Sample Output

### Property Verification Report

```
✅ Property Verification Report

📍 Property Details:
- Survey Number: 234/67/2024
- Address: 42, Green Valley Colony, Jayanagar
- District: Bangalore Urban, Karnataka
- Area: 2400 sqft
- Owner: Rajesh Kumar

📊 Verification Summary:
- Status: APPROVED
- Score: 85/100
- Reason: All compliance checks passed

🔍 Agent Analysis:
✅ Property Verification - Complete
✅ Compliance Check - Complete
✅ Fraud Detection - Complete

⏱️ Processing Time: 1234ms
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run specific test
npm test -- --grep "PropertyVerification"
```

## 📁 Project Structure

```
property-compliance-chatbot/
├── public/
│   └── index.html          # Chat UI
├── src/
│   ├── agents/
│   │   ├── BaseAgent.ts
│   │   ├── PropertyVerificationAgent.ts
│   │   ├── ComplianceAgent.ts
│   │   ├── FraudDetectionAgent.ts
│   │   ├── LoanEligibilityAgent.ts
│   │   ├── DecisionAgent.ts
│   │   └── index.ts        # Orchestrator
│   ├── services/
│   │   └── ChatService.ts
│   ├── types/
│   │   └── index.ts        # TypeScript types
│   └── server.ts           # Express server
├── package.json
├── tsconfig.json
└── README.md
```

## 🔐 Google Cloud Integration

### Required Services

1. **Vertex AI (Gemini)** - Decision reasoning engine
2. **BigQuery** - Land records and compliance data
3. **Cloud Storage** - Document storage
4. **Document AI** - OCR for property documents
5. **Cloud Functions** - Serverless processing

### Setup Instructions

1. Create a Google Cloud project
2. Enable required APIs
3. Create service account with appropriate roles
4. Download credentials JSON
5. Update `.env` with your configuration

## 🎯 Use Cases

### For Buyers
- Verify property before purchase
- Check for legal encumbrances
- Assess loan eligibility
- Reduce fraud risk

### For Banks
- Automated loan processing
- Risk assessment
- Compliance verification
- Fraud detection

### For Government
- Digitized verification workflows
- Improved compliance monitoring
- Transparent audit trails

## 🛣️ Roadmap

- [ ] Google Cloud Vertex AI integration (production)
- [ ] BigQuery data layer
- [ ] Document AI for OCR
- [ ] Real-time notifications
- [ ] Mobile app
- [ ] Multi-language support

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📞 Support

For questions or issues, please open a GitHub issue or contact the team.

---

**Built with ❤️ for the Google Cloud AI Hackathon**

*Transforming property transactions with AI-powered compliance and validation*