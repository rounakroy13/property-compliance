// ============================================
// Chat Service - Handles conversational AI interactions
// ============================================

import type {
  ChatMessage,
  ChatSession,
  ChatContext,
  UserIntent,
  ExtractedEntity,
  Property,
  DocumentType
} from '../types/index.js';
import { orchestrator } from '../agents/index.js';

// Simple UUID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface IntentDetectionResult {
  intent: UserIntent;
  confidence: number;
  entities: ExtractedEntity[];
}

export class ChatService {
  private sessions: Map<string, ChatSession> = new Map();

  createSession(userId?: string): ChatSession {
    const session: ChatSession = {
      id: generateId(),
      userId,
      messages: [],
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const welcomeMessage: ChatMessage = {
      id: generateId(),
      sessionId: session.id,
      role: 'assistant',
      content: this.getWelcomeMessage(),
      timestamp: new Date(),
    };

    session.messages.push(welcomeMessage);
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  async processMessage(sessionId: string, userMessage: string): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      sessionId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    const intentResult = this.detectIntent(userMessage);
    const startTime = Date.now();
    const response = await this.generateResponse(intentResult, session);
    const processingTime = Date.now() - startTime;

    const assistantMsg: ChatMessage = {
      id: generateId(),
      sessionId,
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        processingTime,
      },
    };

    session.messages.push(assistantMsg);
    session.updatedAt = new Date();
    return assistantMsg;
  }

  private getWelcomeMessage(): string {
    return `👋 **Welcome to the Property Compliance & Loan Validation Assistant!**

I'm your AI-powered assistant for property verification and loan processing. I can help you with:

🏠 **Property Verification** - Verify ownership, land records, detect conflicts
📋 **Compliance Checks** - Zoning, tax, environmental clearances
🛡️ **Fraud Detection** - Document authenticity, ownership consistency
💰 **Loan Eligibility** - Calculate eligibility, EMI, interest rates

**How can I help you today?**

💡 *Try saying: "Verify property 123/45/2024" or "Check loan eligibility"*`;
  }

  private detectIntent(message: string): IntentDetectionResult {
    const lowerMessage = message.toLowerCase();
    const entities: ExtractedEntity[] = [];
    let intent: UserIntent = 'general_query';

    if (lowerMessage.includes('verify') || lowerMessage.includes('property') || lowerMessage.includes('ownership')) {
      intent = 'property_verification';
    } else if (lowerMessage.includes('loan') || lowerMessage.includes('eligib') || lowerMessage.includes('emi')) {
      intent = 'loan_application';
    } else if (lowerMessage.includes('compliance') || lowerMessage.includes('tax') || lowerMessage.includes('legal')) {
      intent = 'compliance_check';
    } else if (lowerMessage.includes('document') || lowerMessage.includes('upload')) {
      intent = 'document_upload';
    } else if (lowerMessage.includes('status') || lowerMessage.includes('progress')) {
      intent = 'status_inquiry';
    } else if (lowerMessage.includes('help')) {
      intent = 'help';
    }

    // Extract survey numbers
    const surveyPattern = /\b\d{1,4}[\/\-]\d{1,4}[\/\-]?\d{0,4}\b/g;
    const surveyMatches = message.match(surveyPattern);
    if (surveyMatches) {
      surveyMatches.forEach(match => {
        entities.push({ type: 'survey_number', value: match, confidence: 0.8 });
      });
    }

    return { intent, confidence: 0.8, entities };
  }

  private async generateResponse(
    intentResult: IntentDetectionResult,
    session: ChatSession
  ): Promise<{ content: string }> {
    const { intent, entities } = intentResult;

    switch (intent) {
      case 'property_verification':
        return this.handlePropertyVerification(entities, session);
      case 'loan_application':
        return this.handleLoanApplication();
      case 'compliance_check':
        return this.handleComplianceCheck(session);
      case 'document_upload':
        return this.handleDocumentUpload(session);
      case 'status_inquiry':
        return this.handleStatusInquiry(session);
      case 'help':
        return this.handleHelp();
      default:
        return this.handleGeneralQuery();
    }
  }

  private async handlePropertyVerification(
    entities: ExtractedEntity[],
    session: ChatSession
  ): Promise<{ content: string }> {
    const surveyEntity = entities.find(e => e.type === 'survey_number');
    
    if (surveyEntity) {
      const mockProperty = this.createMockProperty(surveyEntity.value);
      session.context.currentProperty = mockProperty;

      try {
        const result = await orchestrator.runPropertyVerification(mockProperty);
        return { content: this.formatVerificationResult(result, mockProperty) };
      } catch (error) {
        return { content: `❌ Error during verification: ${error}` };
      }
    }

    return {
      content: `🏠 **Property Verification**

To verify a property, I need the **survey number**. 

Please provide the survey number in one of these formats:
• 123/45/2024
• 123-45-2024

Example: "Verify property 234/67/2024"

Or say "**run demo**" to see a sample verification!`,
    };
  }

  private handleLoanApplication(): Promise<{ content: string }> {
    return Promise.resolve({
      content: `💰 **Loan Eligibility Assessment**

To assess your loan eligibility, I'll need:

**Property Details:**
- Survey number or address
- Property value

**Your Financial Details:**
- Monthly income
- Existing EMIs
- Credit score

**Loan Requirements:**
- Loan amount needed
- Preferred tenure

Say "run loan demo" for a sample assessment!`,
    });
  }

  private handleComplianceCheck(session: ChatSession): Promise<{ content: string }> {
    if (session.context.currentProperty) {
      return Promise.resolve({
        content: `📋 Running compliance check for your property...`,
      });
    }

    return Promise.resolve({
      content: `📋 **Compliance Check**

I can verify:
✅ Zoning Compliance
✅ Tax Compliance  
✅ Environmental Compliance
✅ Municipal Approvals

Please provide the property survey number first.`,
    });
  }

  private handleDocumentUpload(session: ChatSession): Promise<{ content: string }> {
    const requiredDocs: DocumentType[] = session.context.awaitingDocuments || [
      'sale_deed',
      'encumbrance_certificate',
      'tax_receipt',
    ];

    const docList = requiredDocs
      .map(doc => `• ${doc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`)
      .join('\n');

    return Promise.resolve({
      content: `📄 **Document Upload**

Upload these documents for verification:

${docList}

**Supported formats:** PDF, JPG, PNG (max 10MB)`,
    });
  }

  private handleStatusInquiry(session: ChatSession): Promise<{ content: string }> {
    if (session.context.verificationInProgress) {
      return Promise.resolve({
        content: `⏳ **Verification In Progress**

Your verification is being processed by our AI agents.`,
      });
    }

    return Promise.resolve({
      content: `📊 **Status**

No active verification in progress. 

Start by saying "verify property" followed by a survey number.`,
    });
  }

  private handleHelp(): Promise<{ content: string }> {
    return Promise.resolve({
      content: `📚 **Help Guide**

I can help with:

🏠 **Property Verification** - "Verify property 123/45/2024"
💰 **Loan Eligibility** - "Check loan eligibility"  
📋 **Compliance Check** - "Run compliance check"
🎯 **Demo** - "Run demo" for a sample verification

What would you like to do?`,
    });
  }

  private handleGeneralQuery(): Promise<{ content: string }> {
    return Promise.resolve({
      content: `I can help you with:

• **Property verification** - "verify property 123/45/2024"
• **Loan eligibility** - "check loan eligibility"
• **Compliance check** - "run compliance check"
• **Demo** - "run demo"

What would you like to do?`,
    });
  }

  private createMockProperty(surveyNumber: string): Property {
    return {
      id: generateId(),
      surveyNumber,
      address: '42, Green Valley Colony, Jayanagar',
      district: 'Bangalore Urban',
      state: 'Karnataka',
      pincode: '560041',
      plotArea: 2400,
      plotAreaUnit: 'sqft',
      currentOwner: {
        name: 'Rajesh Kumar',
        fatherName: 'Suresh Kumar',
        identityType: 'aadhaar',
        identityNumber: 'XXXX-XXXX-1234',
        address: '42, Green Valley Colony, Jayanagar, Bangalore - 560041',
        phone: '+91-9876543210',
        email: 'rajesh.kumar@email.com'
      },
      ownershipHistory: [],
      documents: [],
      verificationStatus: {
        overall: 'pending',
        ownershipVerified: false,
        documentsVerified: false,
        taxesCleared: false,
        noEncumbrance: false,
        zoningCompliant: false
      },
      complianceStatus: {
        overall: 'pending',
        checks: [],
        score: 0,
        maxScore: 100
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private formatVerificationResult(result: unknown, property: Property): string {
    const typedResult = result as { decision?: { result?: { data?: { decision?: { status?: string; reason?: string }; summary?: { score?: number } } } } };
    const decision = typedResult?.decision?.result?.data?.decision;
    const summary = typedResult?.decision?.result?.data?.summary;

    const statusEmoji = decision?.status === 'approved' ? '✅' : 
                        decision?.status === 'conditional' ? '⚠️' : 
                        decision?.status === 'rejected' ? '❌' : '🔍';

    return `${statusEmoji} **Property Verification Report**

📍 **Property Details:**
- Survey Number: ${property.surveyNumber}
- Address: ${property.address}
- District: ${property.district}, ${property.state}
- Area: ${property.plotArea} ${property.plotAreaUnit}
- Owner: ${property.currentOwner.name}

📊 **Verification Summary:**
- Status: **${decision?.status?.toUpperCase() || 'PENDING'}**
- Score: ${summary?.score || 0}/100
- Reason: ${decision?.reason || 'Processing...'}

---
*Report generated by AI Multi-Agent System*`;
  }
}

export const chatService = new ChatService();