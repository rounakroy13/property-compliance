// ============================================
// Chat Service - Handles conversational AI interactions
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type {
  ChatMessage,
  ChatSession,
  ChatContext,
  UserIntent,
  ExtractedEntity,
  Property,
  ApplicantInfo,
  LoanDetails,
  DocumentType
} from '../types/index.js';
import { orchestrator } from '../agents/index.js';

// Simple UUID generator for environments without uuid package
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

  /**
   * Create a new chat session
   */
  createSession(userId?: string): ChatSession {
    const session: ChatSession = {
      id: generateId(),
      userId,
      messages: [],
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add welcome message
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

  /**
   * Get existing session or create new one
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Process user message and generate response
   */
  async processMessage(sessionId: string, userMessage: string): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      sessionId,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    // Detect intent and entities
    const intentResult = this.detectIntent(userMessage, session.context);
    userMsg.metadata = {
      intent: intentResult.intent,
      entities: intentResult.entities,
    };

    // Generate response based on intent
    const startTime = Date.now();
    const response = await this.generateResponse(intentResult, session);
    const processingTime = Date.now() - startTime;

    // Create assistant message
    const assistantMsg: ChatMessage = {
      id: generateId(),
      sessionId,
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        intent: intentResult.intent,
        agentInvoked: response.agentInvoked,
        processingTime,
        sources: response.sources,
      },
    };

    session.messages.push(assistantMsg);
    session.context.lastIntent = intentResult.intent;
    session.updatedAt = new Date();

    return assistantMsg;
  }

  /**
   * Detect user intent from message
   */
  private detectIntent(message: string, context: ChatContext): IntentDetectionResult {
    const lowerMessage = message.toLowerCase();
    const entities: ExtractedEntity[] = [];

    // Intent detection patterns
    const intentPatterns: Array<{
      intent: UserIntent;
      patterns: string[];
      priority: number;
    }> = [
      {
        intent: 'property_verification',
        patterns: ['verify property', 'check property', 'property verification', 'ownership', 'land record', 'survey number', 'validate property'],
        priority: 1,
      },
      {
        intent: 'loan_application',
        patterns: ['loan', 'home loan', 'apply loan', 'loan eligibility', 'emi', 'interest rate', 'borrow', 'mortgage'],
        priority: 1,
      },
      {
        intent: 'compliance_check',
        patterns: ['compliance', 'regulation', 'legal', 'tax', 'zoning', 'permit', 'approval', 'clearance'],
        priority: 2,
      },
      {
        intent: 'document_upload',
        patterns: ['upload', 'document', 'submit', 'attach', 'file', 'paper'],
        priority: 2,
      },
      {
        intent: 'status_inquiry',
        patterns: ['status', 'check status', 'progress', 'update', 'where is', 'how is'],
        priority: 3,
      },
      {
        intent: 'help',
        patterns: ['help', 'how to', 'what can', 'guide', 'assist', 'support'],
        priority: 4,
      },
    ];

    // Find best matching intent
    let bestIntent: UserIntent = 'general_query';
    let bestScore = 0;

    for (const { intent, patterns, priority } of intentPatterns) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          const score = pattern.length / priority;
          if (score > bestScore) {
            bestScore = score;
            bestIntent = intent;
          }
        }
      }
    }

    // Extract entities
    this.extractEntities(message, entities);

    return {
      intent: bestIntent,
      confidence: Math.min(0.9, bestScore / 10 + 0.5),
      entities,
    };
  }

  /**
   * Extract entities from message
   */
  private extractEntities(message: string, entities: ExtractedEntity[]): void {
    // Extract survey numbers (pattern: XX/XX/XXXX or similar)
    const surveyPattern = /\b\d{1,4}[\/\-]\d{1,4}[\/\-]?\d{0,4}\b/g;
    const surveyMatches = message.match(surveyPattern);
    if (surveyMatches) {
      surveyMatches.forEach(match => {
        entities.push({ type: 'survey_number', value: match, confidence: 0.8 });
      });
    }

    // Extract amounts (pattern: ₹XX,XXX or Rs.XXX)
    const amountPattern = /(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{2})?/gi;
    const amountMatches = message.match(amountPattern);
    if (amountMatches) {
      amountMatches.forEach(match => {
        const value = match.replace(/[^\d.]/g, '');
        entities.push({ type: 'amount', value, confidence: 0.85 });
      });
    }

    // Extract names (capitalized words after "name is" or "owner")
    const namePattern = /(?:name is|owner[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
    const nameMatch = message.match(namePattern);
    if (nameMatch) {
      entities.push({ type: 'person_name', value: nameMatch[1], confidence: 0.7 });
    }

    // Extract area/location
    const locationKeywords = ['bangalore', 'mumbai', 'delhi', 'chennai', 'hyderabad', 'pune', 'kolkata'];
    locationKeywords.forEach(city => {
      if (message.toLowerCase().includes(city)) {
        entities.push({ type: 'location', value: city, confidence: 0.9 });
      }
    });
  }

  /**
   * Generate response based on intent
   */
  private async generateResponse(
    intentResult: IntentDetectionResult,
    session: ChatSession
  ): Promise<{ content: string; agentInvoked?: string; sources?: string[] }> {
    const { intent, entities } = intentResult;

    switch (intent) {
      case 'property_verification':
        return this.handlePropertyVerification(entities, session);

      case 'loan_application':
        return this.handleLoanApplication(entities, session);

      case 'compliance_check':
        return this.handleComplianceCheck(entities, session);

      case 'document_upload':
        return this.handleDocumentUpload(entities, session);

      case 'status_inquiry':
        return this.handleStatusInquiry(session);

      case 'help':
        return this.handleHelp();

      default:
        return this.handleGeneralQuery(session);
    }
  }

  /**
   * Handle property verification intent
   */
  private async handlePropertyVerification(
    entities: ExtractedEntity[],
    session: ChatSession
  ): Promise<{ content: string; agentInvoked?: string; sources?: string[] }> {
    // Check if we have property details
    if (!session.context.currentProperty) {
      const surveyEntity = entities.find(e => e.type === 'survey_number');
      
      if (surveyEntity) {
        // Create mock property for demo
        const mockProperty = this.createMockProperty(surveyEntity.value);
        session.context.currentProperty = mockProperty;
        session.context.verificationInProgress = true;

        // Run verification
        const result = await orchestrator.runPropertyVerification(mockProperty);
        session.context.verificationInProgress = false;

        const decision = result.decision.result?.data as Record<string, unknown>;
        const summary = decision?.summary as Record<string, unknown>;

        return {
          content: this.formatVerificationResult(result, mockProperty),
          agentInvoked: 'property_verification',
          sources: ['Land Records Database', 'Tax Records', 'Compliance Registry'],
        };
      }

      return {
        content: `I'd be happy to help verify a property for you! 🏠

To proceed with property verification, I need some details:

1. **Survey Number** - The unique identifier for the property
2. **Property Address** - Location of the property
3. **Owner Name** - Current owner's name

You can provide the survey number (e.g., "123/45/2024") and I'll start the verification process.

Alternatively, you can upload property documents like:
- Sale Deed
- Encumbrance Certificate
- Tax Receipts

What information do you have available?`,
      };
    }

    // Property already in context, run verification
    const result = await orchestrator.runPropertyVerification(session.context.currentProperty);
    return {
      content: this.formatVerificationResult(result, session.context.currentProperty),
      agentInvoked: 'property_verification',
      sources: ['Land Records Database', 'Tax Records', 'Compliance Registry'],
    };
  }

  /**
   * Handle loan application intent
   */
  private async handleLoanApplication(
    entities: ExtractedEntity[],
    session: ChatSession
  ): Promise<{ content: string; agentInvoked?: string; sources?: string[] }> {
    if (!session.context.currentProperty || !session.context.userProfile) {
      const amountEntity = entities.find(e => e.type === 'amount');
      
      return {
        content: `I can help you with your home loan application! 💰

To assess your loan eligibility, I'll need the following information:

**Property Details:**
- Survey number or property address
- Property value (estimated or actual)

**Applicant Details:**
- Full name and date of birth
- Employment type (Salaried/Self-employed/Business)
- Monthly income
- Existing EMIs (if any)
- Credit score (if known)

**Loan Requirements:**
- Loan amount needed${amountEntity ? ` (I noticed you mentioned ₹${parseInt(amountEntity.value).toLocaleString()})` : ''}
- Preferred loan tenure (in months)
- Purpose (Purchase/Construction/Renovation)

Would you like to proceed step by step, or do you have all the details ready?

💡 **Tip:** You can also say something like "I want a loan of ₹50 lakhs for 20 years" to get started quickly!`,
      };
    }

    // Create mock loan application
    const mockLoanApplication = this.createMockLoanApplication(session.context);
    session.context.currentLoanApplication = mockLoanApplication;

    const result = await orchestrator.runLoanApplication(mockLoanApplication);
    return {
      content: this.formatLoanResult(result),
      agentInvoked: 'loan_eligibility',
      sources: ['Credit Bureau', 'Bank Policy Database', 'Property Valuation'],
    };
  }

  /**
   * Handle compliance check intent
   */
  private async handleComplianceCheck(
    entities: ExtractedEntity[],
    session: ChatSession
  ): Promise<{ content: string; agentInvoked?: string; sources?: string[] }> {
    if (!session.context.currentProperty) {
      return {
        content: `I can run a comprehensive compliance check for your property! 📋

The compliance check includes:

✅ **Zoning Compliance** - Land use and zoning regulations
✅ **Tax Compliance** - Property tax payment status
✅ **Environmental Compliance** - Environmental clearances
✅ **Municipal Approvals** - Building permits and NOCs
✅ **Document Compliance** - Required legal documents

To proceed, please provide:
1. Property survey number or address
2. Any available property documents

Would you like to start with a property survey number?`,
      };
    }

    // Run compliance check through orchestrator
    const result = await orchestrator.runPropertyVerification(session.context.currentProperty);
    const complianceResult = result.compliance.result?.data as Record<string, unknown>;
    
    return {
      content: this.formatComplianceResult(complianceResult),
      agentInvoked: 'compliance',
      sources: ['Municipal Records', 'Tax Database', 'Zoning Registry'],
    };
  }

  /**
   * Handle document upload intent
   */
  private handleDocumentUpload(
    entities: ExtractedEntity[],
    session: ChatSession
  ): Promise<{ content: string; agentInvoked?: string; sources?: string[] }> {
    const requiredDocs: DocumentType[] = session.context.awaitingDocuments || [
      'sale_deed',
      'encumbrance_certificate',
      'tax_receipt',
      'identity_proof',
    ];

    const docList = requiredDocs
      .map(doc => `• ${doc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`)
      .join('\n');

    return Promise.resolve({
      content: `📄 **Document Upload**

You can upload the following documents for verification:

${docList}

**Supported formats:** PDF, JPG, PNG (max 10MB each)

To upload, you can:
1. Drag and drop files here
2. Click the upload button below
3. Take a photo of the document

Our AI will automatically extract information from your documents and verify them against government databases.

Which document would you like to upload first?`,
    });
  }

  /**
   * Handle status inquiry
   */
  private handleStatusInquiry(
    session: ChatSession
  ): Promise<{ content: string; agentInvoked?: string; sources?: string[] }> {
    const { currentProperty, currentLoanApplication, verificationInProgress } = session.context;

    if (verificationInProgress) {
      return Promise.resolve({
        content: `⏳ **Verification In Progress**

Your verification is currently being processed. Our AI agents are:

1. ✅ Verifying property ownership
2. ⏳ Checking compliance records
3. ⏳ Running fraud detection
4. ⏳ Calculating eligibility

Estimated time remaining: 30 seconds

I'll update you as soon as the verification is complete!`,
      });
    }

    if (currentLoanApplication) {
      return