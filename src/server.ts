// ============================================
// Property Compliance Chatbot - Express Server
// ============================================

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { orchestrator } from './agents/index.js';
import type { Property, LoanApplication, AgentType } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Simple in-memory session store
const sessions = new Map<string, ChatSessionData>();

interface ChatSessionData {
  id: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  context: Record<string, unknown>;
  createdAt: Date;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// API Routes
// ============================================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get agents info
app.get('/api/agents', async (req: Request, res: Response) => {
  try {
    await orchestrator.initialize();
    const agents = orchestrator.getAgentsInfo();
    res.json({ success: true, agents });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get agents info' });
  }
});

// Create new chat session
app.post('/api/chat/session', (req: Request, res: Response) => {
  const sessionId = generateId();
  const session: ChatSessionData = {
    id: sessionId,
    messages: [{
      role: 'assistant',
      content: getWelcomeMessage(),
      timestamp: new Date()
    }],
    context: {},
    createdAt: new Date()
  };
  sessions.set(sessionId, session);
  res.json({ success: true, session });
});

// Get chat session
app.get('/api/chat/session/:sessionId', (req: Request, res: Response) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, session });
});

// Send message
app.post('/api/chat/message', async (req: Request, res: Response) => {
  try {
    const { sessionId, message } = req.body;
    
    let session = sessions.get(sessionId);
    if (!session) {
      // Create new session if not exists
      session = {
        id: sessionId || generateId(),
        messages: [],
        context: {},
        createdAt: new Date()
      };
      sessions.set(session.id, session);
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Process message and generate response
    const response = await processUserMessage(message, session);
    
    // Add assistant message
    session.messages.push({
      role: 'assistant',
      content: response.content,
      timestamp: new Date()
    });

    res.json({
      success: true,
      response: {
        content: response.content,
        agentInvoked: response.agentInvoked,
        processingTime: response.processingTime
      }
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ success: false, error: 'Failed to process message' });
  }
});

// Run property verification
app.post('/api/verify/property', async (req: Request, res: Response) => {
  try {
    const property = req.body.property as Property;
    
    if (!property) {
      return res.status(400).json({ success: false, error: 'Property data required' });
    }

    await orchestrator.initialize();
    const result = await orchestrator.runPropertyVerification(property);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error verifying property:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// Run loan application
app.post('/api/verify/loan', async (req: Request, res: Response) => {
  try {
    const loanApplication = req.body.loanApplication as LoanApplication;
    
    if (!loanApplication) {
      return res.status(400).json({ success: false, error: 'Loan application data required' });
    }

    await orchestrator.initialize();
    const result = await orchestrator.runLoanApplication(loanApplication);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error processing loan:', error);
    res.status(500).json({ success: false, error: 'Loan processing failed' });
  }
});

// Run single agent
app.post('/api/agent/:agentType', async (req: Request, res: Response) => {
  try {
    const agentType = req.params.agentType as AgentType;
    const input = req.body;

    await orchestrator.initialize();
    const result = await orchestrator.runAgent(agentType, input);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error running agent:', error);
    res.status(500).json({ success: false, error: 'Agent execution failed' });
  }
});

// Demo endpoint - creates sample property and runs verification
app.post('/api/demo/verify', async (req: Request, res: Response) => {
  try {
    const sampleProperty = createSampleProperty();
    
    await orchestrator.initialize();
    const result = await orchestrator.runPropertyVerification(sampleProperty);
    
    res.json({
      success: true,
      property: sampleProperty,
      result,
      summary: formatResultSummary(result)
    });
  } catch (error) {
    console.error('Demo error:', error);
    res.status(500).json({ success: false, error: 'Demo failed' });
  }
});

// ============================================
// Helper Functions
// ============================================

function getWelcomeMessage(): string {
  return `👋 **Welcome to the Property Compliance & Loan Validation Assistant!**

I'm your AI-powered assistant for property verification and loan processing. I can help you with:

🏠 **Property Verification**
- Verify ownership records
- Check land records
- Detect ownership conflicts

📋 **Compliance Checks**
- Zoning compliance
- Tax payment status
- Environmental clearances
- Municipal approvals

🛡️ **Fraud Detection**
- Document authenticity
- Ownership consistency
- Transaction pattern analysis

💰 **Loan Eligibility**
- Calculate loan eligibility
- Assess financial profile
- Estimate EMI and interest rates

**How can I help you today?**

💡 *Try saying: "Verify property 123/45/2024" or "Check loan eligibility"*`;
}

async function processUserMessage(
  message: string, 
  session: ChatSessionData
): Promise<{ content: string; agentInvoked?: string; processingTime: number }> {
  const startTime = Date.now();
  const lowerMessage = message.toLowerCase();

  // Detect intent
  if (lowerMessage.includes('verify') && lowerMessage.includes('property') || 
      lowerMessage.includes('survey') || lowerMessage.includes('ownership')) {
    return handlePropertyVerification(message, session, startTime);
  }

  if (lowerMessage.includes('loan') || lowerMessage.includes('eligib') || 
      lowerMessage.includes('emi') || lowerMessage.includes('mortgage')) {
    return handleLoanQuery(message, session, startTime);
  }

  if (lowerMessage.includes('compliance') || lowerMessage.includes('tax') || 
      lowerMessage.includes('legal') || lowerMessage.includes('zoning')) {
    return handleComplianceQuery(message, session, startTime);
  }

  if (lowerMessage.includes('fraud') || lowerMessage.includes('authentic') || 
      lowerMessage.includes('fake')) {
    return handleFraudQuery(message, session, startTime);
  }

  if (lowerMessage.includes('help') || lowerMessage.includes('what can')) {
    return {
      content: getHelpMessage(),
      processingTime: Date.now() - startTime
    };
  }

  if (lowerMessage.includes('demo') || lowerMessage.includes('example') || 
      lowerMessage.includes('sample')) {
    return handleDemoRequest(session, startTime);
  }

  // Default response
  return {
    content: `I understand you're asking about: "${message}"

I can help you with:
• **Property verification** - Say "verify property" followed by a survey number
• **Loan eligibility** - Say "check loan eligibility" to assess your loan options
• **Compliance check** - Say "compliance check" to verify regulatory compliance
• **Demo** - Say "run demo" to see a sample verification

What would you like to do?`,
    processingTime: Date.now() - startTime
  };
}

async function handlePropertyVerification(
  message: string, 
  session: ChatSessionData,
  startTime: number
): Promise<{ content: string; agentInvoked?: string; processingTime: number }> {
  // Extract survey number
  const surveyMatch = message.match(/\b\d{1,4}[\/\-]\d{1,4}[\/\-]?\d{0,4}\b/);
  
  if (surveyMatch) {
    const surveyNumber = surveyMatch[0];
    const property = createSampleProperty(surveyNumber);
    
    session.context.currentProperty = property;
    
    try {
      await orchestrator.initialize();
      const result = await orchestrator.runPropertyVerification(property);
      
      return {
        content: formatVerificationResult(result, property),
        agentInvoked: 'property_verification',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        content: `❌ Error verifying property: ${error}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  return {
    content: `🏠 **Property Verification**

To verify a property, I need the **survey number**. 

Please provide the survey number in one of these formats:
• 123/45/2024
• 123-45-2024
• 123/45

Example: "Verify property 234/67/2024"

Or say "**run demo**" to see a sample verification!`,
    processingTime: Date.now() - startTime
  };
}

async function handleLoanQuery(
  message: string, 
  session: ChatSessionData,
  startTime: number
): Promise<{ content: string; agentInvoked?: string; processingTime: number }> {
  return {
    content: `💰 **Loan Eligibility Assessment**

To assess your loan eligibility, I'll need:

**1. Property Information:**
- Survey number or address
- Estimated property value

**2. Your Financial Details:**
- Monthly income
- Existing EMIs (if any)
- Employment type (Salaried/Self-employed)
- Credit score (if known)

**3. Loan Requirements:**
- Loan amount needed
- Preferred tenure (in months)

📝 For a quick demo, say "**run loan demo**"

Or provide your details and I'll calculate your eligibility!`,
    processingTime: Date.now() - startTime
  };
}

async function handleComplianceQuery(
  message: string, 
  session: ChatSessionData,
  startTime: number
): Promise<{ content: string; agentInvoked?: string; processingTime: number }> {
  return {
    content: `📋 **Compliance Check**

I can verify compliance across multiple categories:

✅ **Zoning Compliance**
- Land use regulations
- Zone restrictions

✅ **Tax Compliance**
- Property tax payments
- Outstanding dues

✅ **Environmental Compliance**
- Environmental clearances
- Restrictions

✅ **Municipal Approvals**
- Building permits
- Required NOCs

✅ **Document Compliance**
- Required legal documents
- Registration status

To run a compliance check, provide the property survey number or say "**run demo**"!`,
    processingTime: Date.now() - startTime
  };
}

async function handleFraudQuery(
  message: string, 
  session: ChatSessionData,
  startTime: number
): Promise<{ content: string; agentInvoked?: string; processingTime: number }> {
  return {
    content: `🛡️ **Fraud Detection**

Our AI-powered fraud detection system analyzes:

🔍 **Document Authenticity**
- Verify document integrity
- Detect tampering

🔍 **Ownership Consistency**
- Cross-reference with land records
- Identify mismatches

🔍 **Transaction Patterns**
- Analyze historical transactions
- Detect suspicious patterns

🔍 **Price Manipulation**
- Compare with market values
- Identify anomalies

To run fraud detection, provide property details or say "**run demo**"!`,
    processingTime: Date.now() - startTime
  };
}

async function handleDemoRequest(
  session: ChatSessionData,
  startTime: number
): Promise<{ content: string; agentInvoked?: string; processingTime: number }> {
  try {
    const property = createSampleProperty();
    session.context.currentProperty = property;
    
    await orchestrator.initialize();
    const result = await orchestrator.runPropertyVerification(property);
    
    return {
      content: `🎯 **Demo: Property Verification Complete!**\n\n${formatVerificationResult(result, property)}`,
      agentInvoked: 'decision',
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      content: `❌ Demo error: ${error}`,
      processingTime: Date.now() - startTime
    };
  }
}

function getHelpMessage(): string {
  return `📚 **Help Guide**

Here's what I can do for you:

**🏠 Property Verification**
- "Verify property 123/45/2024"
- "Check ownership for survey 456/78"

**💰 Loan Eligibility**
- "Check loan eligibility"
- "I want a home loan"

**📋 Compliance Check**
- "Run compliance check"
- "Check tax status"

**🛡️ Fraud Detection**
- "Check document authenticity"
- "Verify ownership records"

**🎯 Demo**
- "Run demo" - See a complete verification example

**💡 Tips:**
- Include survey numbers for faster processing
- Upload documents for detailed analysis
- Ask follow-up questions anytime!

What would you like to explore?`;
}

function createSampleProperty(surveyNumber?: string): Property {
  return {
    id: generateId(),
    surveyNumber: surveyNumber || '234/67/2024',
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
    ownershipHistory: [
      {
        ownerName: 'Suresh Kumar',
        fromDate: '2010-01-15',
        toDate: '2020-06-20',
        transactionType: 'purchase',
        documentReference: 'REG/2010/12345'
      },
      {
        ownerName: 'Rajesh Kumar',
        fromDate: '2020-06-20',
        transactionType: 'inheritance',
        documentReference: 'REG/2020/67890'
      }
    ],
    documents: [
      {
        id: 'doc-1',
        type: 'sale_deed',
        fileName: 'sale_deed.pdf',
        fileUrl: '/documents/sale_deed.pdf',
        uploadedAt: new Date('2024-01-15'),
        status: 'verified',
        extractedData: {
          ownerName: 'Rajesh Kumar',
          propertyAddress: '42, Green Valley Colony, Jayanagar',
          surveyNumber: surveyNumber || '234/67/2024',
          registrationNumber: 'REG/2020/67890',
          registrationDate: '2020-06-20',
          confidence: 0.95,
          extractedFields: {
            ownerName: 'Rajesh Kumar',
            propertyAddress: '42, Green Valley Colony',
            registrationNumber: 'REG/2020/67890'
          }
        }
      },
      {
        id: 'doc-2',
        type: 'tax_receipt',
        fileName: 'tax_receipt_2024.pdf',
        fileUrl: '/documents/tax_receipt.pdf',
        uploadedAt: new Date('2024-03-10'),
        status: 'verified',
        extractedData: {
          ownerName: 'Rajesh Kumar',
          taxAmount: 15000,
          taxYear: '2024-25',
          confidence: 0.92,
          extractedFields: {
            ownerName: 'Rajesh Kumar',
            taxAmount: '15000',
            taxYear: '2024-25'
          }
        }
      }
    ],
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

function formatVerificationResult(result: any, property: Property): string {
  const decision = result.decision?.result?.data?.decision;
  const summary = result.decision?.result?.data?.summary;
  const processingTime = result.processingTime;

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

🔍 **Agent Analysis:**
${result.propertyVerification?.status === 'completed' ? '✅' : '⏳'} Property Verification
${result.compliance?.status === 'completed' ? '✅' : '⏳'} Compliance Check
${result.fraudDetection?.status === 'completed' ? '✅' : '⏳'} Fraud Detection

⏱️ Processing Time: ${processingTime}ms

${decision?.explanation || ''}

---
*Report generated by AI Multi-Agent System*`;
}

function formatResultSummary(result: any): string {
  const decision = result.decision?.result?.data?.decision;
  return `Status: ${decision?.status || 'pending'}, Score: ${result.decision?.result?.data?.summary?.score || 0}/100`;
}

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   Property Compliance & Loan Validation Chatbot Server     ║
╠════════════════════════════════════════════════════════════╣
║   🚀 Server running on http://localhost:${PORT}              ║
║   📡 API available at http://localhost:${PORT}/api           ║
║   💬 Chat UI at http://localhost:${PORT}                     ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  // Initialize agents on startup
  orchestrator.initialize().then(() => {
    console.log('✅ All AI agents initialized and ready!');
  }).catch(err => {
    console.error('❌ Failed to initialize agents:', err);
  });
});

export default app;
