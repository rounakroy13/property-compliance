// ============================================
// Fraud Detection Agent
// Detects forged documents, ownership mismatches, suspicious transactions
// ============================================

import { BaseAgent, AgentConfig } from './BaseAgent.js';
import type { 
  AgentTaskResult, 
  Property, 
  PropertyDocument,
  FraudAnalysis,
  FraudAlert,
  RiskLevel,
  DocumentAuthenticityResult,
  LandRecord
} from '../types/index.js';

interface FraudDetectionInput {
  property: Property;
  landRecords?: LandRecord[];
  historicalTransactions?: TransactionRecord[];
}

interface TransactionRecord {
  transactionId: string;
  propertyId: string;
  buyerName: string;
  sellerName: string;
  transactionDate: string;
  amount: number;
  registrationNumber: string;
}

const agentConfig: AgentConfig = {
  name: 'Fraud Detection Agent',
  description: 'Detects forged documents, ownership mismatches, and suspicious transactions',
  capabilities: [
    'Detect forged or tampered documents',
    'Identify ownership mismatches',
    'Analyze suspicious transaction patterns',
    'Verify document authenticity',
    'Check for multiple ownership claims',
    'Detect price manipulation'
  ],
  maxRetries: 3,
  timeout: 45000,
};

export class FraudDetectionAgent extends BaseAgent {
  constructor() {
    super('fraud_detection', agentConfig);
  }

  protected async onInitialize(): Promise<void> {
    console.log('[FraudDetectionAgent] Loading fraud detection models...');
  }

  protected async process(input: Record<string, unknown>): Promise<AgentTaskResult> {
    const typedInput = input as unknown as FraudDetectionInput;
    const { property, landRecords, historicalTransactions } = typedInput;

    const alerts: FraudAlert[] = [];
    const documentResults: DocumentAuthenticityResult[] = [];
    const recommendations: Array<{ priority: 'high' | 'medium' | 'low'; action: string }> = [];

    // 1. Check Document Authenticity
    for (const doc of property.documents) {
      const authResult = await this.checkDocumentAuthenticity(doc);
      documentResults.push(authResult);
      
      if (!authResult.isAuthentic) {
        alerts.push({
          type: 'forged_document',
          severity: 'high',
          description: `Potential document forgery detected: ${doc.type}`,
          evidence: authResult.issues,
          recommendation: `Verify the authenticity of ${doc.type} with issuing authority`
        });
      }
    }

    // 2. Check Ownership Consistency
    const ownershipAlert = await this.checkOwnershipConsistency(property, landRecords);
    if (ownershipAlert) {
      alerts.push(ownershipAlert);
    }

    // 3. Check for Multiple Ownership Claims
    const multipleClaimsAlert = await this.checkMultipleOwnershipClaims(property, landRecords);
    if (multipleClaimsAlert) {
      alerts.push(multipleClaimsAlert);
    }

    // 4. Analyze Transaction Patterns
    const transactionAlerts = await this.analyzeTransactionPatterns(property, historicalTransactions);
    alerts.push(...transactionAlerts);

    // 5. Check for Price Manipulation
    const priceAlert = await this.checkPriceManipulation(property, historicalTransactions);
    if (priceAlert) {
      alerts.push(priceAlert);
    }

    // 6. Check Document Tampering
    const tamperingAlerts = await this.checkDocumentTampering(property.documents);
    alerts.push(...tamperingAlerts);

    // Build fraud analysis result
    const fraudAnalysis: FraudAnalysis = {
      isSuspicious: alerts.some(a => a.severity === 'high' || a.severity === 'critical'),
      confidenceScore: this.calculateFraudConfidence(alerts, documentResults),
      alerts,
      documentAuthenticity: documentResults,
      ownershipConsistency: !alerts.some(a => a.type === 'ownership_mismatch'),
      transactionPatternAnalysis: this.generateTransactionAnalysis(historicalTransactions)
    };

    // Generate recommendations
    alerts.forEach(alert => {
      recommendations.push({
        priority: alert.severity === 'critical' || alert.severity === 'high' ? 'high' : 
                  alert.severity === 'medium' ? 'medium' : 'low',
        action: alert.recommendation
      });
    });

    const confidence = fraudAnalysis.confidenceScore;
    const reasoning = this.generateReasoning(
      [
        `Analyzed ${property.documents.length} documents`,
        `Found ${alerts.length} potential fraud indicators`,
        `Document authenticity: ${documentResults.filter(d => d.isAuthentic).length}/${documentResults.length} verified`,
        `Ownership consistency: ${fraudAnalysis.ownershipConsistency ? 'Verified' : 'Issues Found'}`,
        `Risk Level: ${this.determineOverallRisk(alerts)}`
      ],
      fraudAnalysis.isSuspicious 
        ? 'ALERT: Potential fraud indicators detected. Manual review strongly recommended.'
        : 'No significant fraud indicators detected. Property appears legitimate.'
    );

    return {
      success: !fraudAnalysis.isSuspicious,
      data: {
        fraudAnalysis,
        alertCount: alerts.length,
        highSeverityAlerts: alerts.filter(a => a.severity === 'high' || a.severity === 'critical').length,
        analyzedAt: new Date().toISOString(),
      },
      confidence,
      reasoning,
      recommendations: this.formatRecommendations(recommendations),
    };
  }

  private async checkDocumentAuthenticity(doc: PropertyDocument): Promise<DocumentAuthenticityResult> {
    const issues: string[] = [];
    let confidenceScore = 1.0;

    // Check 1: Document has extracted data
    if (!doc.extractedData || Object.keys(doc.extractedData.extractedFields).length === 0) {
      issues.push('Document data extraction incomplete or failed');
      confidenceScore -= 0.2;
    }

    // Check 2: Extraction confidence
    if (doc.extractedData && doc.extractedData.confidence < 0.7) {
      issues.push(`Low extraction confidence: ${(doc.extractedData.confidence * 100).toFixed(1)}%`);
      confidenceScore -= 0.15;
    }

    // Check 3: Document status
    if (doc.status === 'failed') {
      issues.push('Document processing failed - unable to verify');
      confidenceScore -= 0.3;
    }

    // Check 4: Required fields present for document type
    const requiredFields = this.getRequiredFields(doc.type);
    if (doc.extractedData) {
      const missingFields = requiredFields.filter(
        field => !doc.extractedData?.extractedFields[field]
      );
      if (missingFields.length > 0) {
        issues.push(`Missing required fields: ${missingFields.join(', ')}`);
        confidenceScore -= 0.1 * missingFields.length;
      }
    }

    // Check 5: Date validation
    if (doc.extractedData?.registrationDate) {
      const regDate = new Date(doc.extractedData.registrationDate);
      const now = new Date();
      if (regDate > now) {
        issues.push('Future registration date detected - possible forgery');
        confidenceScore -= 0.4;
      }
    }

    return {
      documentId: doc.id,
      documentType: doc.type,
      isAuthentic: issues.length === 0 || confidenceScore >= 0.7,
      confidenceScore: Math.max(0, Math.min(1, confidenceScore)),
      issues
    };
  }

  private getRequiredFields(docType: PropertyDocument['type']): string[] {
    const fieldMap: Record<PropertyDocument['type'], string[]> = {
      sale_deed: ['ownerName', 'propertyAddress', 'registrationNumber', 'registrationDate'],
      encumbrance_certificate: ['propertyAddress', 'surveyNumber'],
      tax_receipt: ['ownerName', 'taxAmount', 'taxYear'],
      identity_proof: ['name', 'identityNumber'],
      income_proof: ['name', 'income'],
      bank_statement: ['accountHolder', 'bankName'],
      property_survey: ['surveyNumber', 'plotArea'],
      zoning_certificate: ['zone', 'allowedUsage'],
      environmental_clearance: ['clearanceNumber', 'validUntil'],
      building_permit: ['permitNumber', 'approvalDate'],
      other: []
    };
    return fieldMap[docType] || [];
  }

  private async checkOwnershipConsistency(
    property: Property,
    landRecords?: LandRecord[]
  ): Promise<FraudAlert | null> {
    if (!landRecords || landRecords.length === 0) {
      return null;
    }

    const matchingRecord = landRecords.find(
      record => record.survey_number === property.surveyNumber
    );

    if (!matchingRecord) {
      return {
        type: 'ownership_mismatch',
        severity: 'high',
        description: 'Property not found in official land records',
        evidence: [`Survey number ${property.surveyNumber} not found in government database`],
        recommendation: 'Verify property existence with local land revenue office'
      };
    }

    const recordOwner = matchingRecord.owner_name.toLowerCase().trim();
    const propertyOwner = property.currentOwner.name.toLowerCase().trim();

    if (recordOwner !== propertyOwner) {
      const recordParts = recordOwner.split(' ');
      const propertyParts = propertyOwner.split(' ');
      const hasPartialMatch = recordParts.some(p => propertyParts.includes(p) && p.length > 2);

      if (!hasPartialMatch) {
        return {
          type: 'ownership_mismatch',
          severity: 'critical',
          description: 'Owner name does not match land records',
          evidence: [
            `Claimed owner: ${property.currentOwner.name}`,
            `Land record owner: ${matchingRecord.owner_name}`
          ],
          recommendation: 'Verify ownership with original documents and land registry'
        };
      }
    }

    return null;
  }

  private async checkMultipleOwnershipClaims(
    property: Property,
    landRecords?: LandRecord[]
  ): Promise<FraudAlert | null> {
    if (!landRecords) return null;

    const duplicateRecords = landRecords.filter(
      r => r.survey_number === property.surveyNumber
    );

    if (duplicateRecords.length > 1) {
      const owners = duplicateRecords.map(r => r.owner_name);
      return {
        type: 'multiple_ownership_claims',
        severity: 'critical',
        description: 'Multiple ownership claims detected for this property',
        evidence: [
          `Found ${duplicateRecords.length} different ownership records`,
          `Claimants: ${owners.join(', ')}`
        ],
        recommendation: 'Conduct thorough title search and legal verification'
      };
    }

    return null;
  }

  private async analyzeTransactionPatterns(
    property: Property,
    transactions?: TransactionRecord[]
  ): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    if (!transactions || transactions.length < 2) {
      return alerts;
    }

    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    // Check for rapid succession of transactions
    for (let i = 1; i < sortedTransactions.length; i++) {
      const prev = sortedTransactions[i - 1];
      const curr = sortedTransactions[i];
      const daysDiff = (new Date(curr.transactionDate).getTime() - 
                        new Date(prev.transactionDate).getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff < 90) {
        alerts.push({
          type: 'suspicious_transaction',
          severity: 'medium',
          description: 'Rapid property transfer detected',
          evidence: [
            `Transaction on ${prev.transactionDate} followed by another on ${curr.transactionDate}`,
            `Only ${Math.round(daysDiff)} days between transactions`
          ],
          recommendation: 'Investigate reason for rapid ownership changes'
        });
      }
    }

    // Check for circular transactions
    const buyerCounts = new Map<string, number>();
    const sellerCounts = new Map<string, number>();

    transactions.forEach(t => {
      buyerCounts.set(t.buyerName, (buyerCounts.get(t.buyerName) || 0) + 1);
      sellerCounts.set(t.sellerName, (sellerCounts.get(t.sellerName) || 0) + 1);
    });

    buyerCounts.forEach((count, name) => {
      if (count > 1 && sellerCounts.has(name)) {
        alerts.push({
          type: 'suspicious_transaction',
          severity: 'high',
          description: 'Circular transaction pattern detected',
          evidence: [
            `${name} appears as both buyer and seller in transaction history`,
            `Appeared ${count} times as buyer`
          ],
          recommendation: 'Investigate for potential benami transactions'
        });
      }
    });

    return alerts;
  }

  private async checkPriceManipulation(
    property: Property,
    transactions?: TransactionRecord[]
  ): Promise<FraudAlert | null> {
    if (!transactions || transactions.length < 2) {
      return null;
    }

    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    for (let i = 1; i < sortedTransactions.length; i++) {
      const prev = sortedTransactions[i - 1];
      const curr = sortedTransactions[i];
      const priceChange = ((curr.amount - prev.amount) / prev.amount) * 100;
      const daysDiff = (new Date(curr.transactionDate).getTime() - 
                        new Date(prev.transactionDate).getTime()) / (1000 * 60 * 60 * 24);

      if (priceChange > 50 && daysDiff < 365) {
        return {
          type: 'price_manipulation',
          severity: 'medium',
          description: 'Unusual price appreciation detected',
          evidence: [
            `Price increased by ${priceChange.toFixed(1)}% in ${Math.round(daysDiff)} days`,
            `From ₹${prev.amount.toLocaleString()} to ₹${curr.amount.toLocaleString()}`
          ],
          recommendation: 'Verify market value with registered valuer'
        };
      }

      if (priceChange < -30) {
        return {
          type: 'price_manipulation',
          severity: 'medium',
          description: 'Unusual price depreciation detected',
          evidence: [
            `Price decreased by ${Math.abs(priceChange).toFixed(1)}%`,
            `From ₹${prev.amount.toLocaleString()} to ₹${curr.amount.toLocaleString()}`
          ],
          recommendation: 'Verify if transaction value reflects actual market price'
        };
      }
    }

    return null;
  }

  private async checkDocumentTampering(documents: PropertyDocument[]): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    for (const doc of documents) {
      // Check for inconsistent dates
      if (doc.extractedData?.registrationDate && doc.uploadedAt) {
        const regDate = new Date(doc.extractedData.registrationDate);
        const uploadDate = new Date(doc.uploadedAt);
        
        // Registration date should be before upload date
        if (regDate > uploadDate) {
          alerts.push({
            type: 'document_tampering',
            severity: 'high',
            description: `Document ${doc.type} has inconsistent dates`,
            evidence: [
              `Registration date: ${doc.extractedData.registrationDate}`,
              `Upload date: ${uploadDate.toISOString().split('T')[0]}`
            ],
            recommendation: 'Verify document authenticity with issuing authority'
          });
        }
      }

      // Check for very old documents without proper archival
      if (doc.extractedData?.registrationDate) {
        const regDate = new Date(doc.extractedData.registrationDate);
        const yearsDiff = (new Date().getFullYear() - regDate.getFullYear());
        
        if (yearsDiff > 30 && doc.extractedData.confidence > 0.95) {
          alerts.push({
            type: 'document_tampering',
            severity: 'low',
            description: `Very old document with unusually high quality`,
            evidence: [
              `Document is ${yearsDiff} years old`,
              `Extraction confidence: ${(doc.extractedData.confidence * 100).toFixed(1)}%`
            ],
            recommendation: 'Verify if document is an authentic copy or original'
          });
        }
      }
    }

    return alerts;
  }

  private calculateFraudConfidence(alerts: FraudAlert[], documentResults: DocumentAuthenticityResult[]): number {
    // Start with base confidence of 1.0 (no fraud)
    let confidence = 1.0;

    // Reduce confidence based on alerts
    alerts.forEach(alert => {
      switch (alert.severity) {
        case 'critical':
          confidence -= 0.3;
          break;
        case 'high':
          confidence -= 0.2;
          break;
        case 'medium':
          confidence -= 0.1;
          break;
        case 'low':
          confidence -= 0.05;
          break;
      }
    });

    // Factor in document authenticity
    const avgDocConfidence = documentResults.length > 0
      ? documentResults.reduce((sum, d) => sum + d.confidenceScore, 0) / documentResults.length
      : 1.0;

    confidence = (confidence + avgDocConfidence) / 2;

    return Math.max(0, Math.min(1, confidence));
  }

  private generateTransactionAnalysis(transactions?: TransactionRecord[]): string {
    if (!transactions || transactions.length === 0) {
      return 'No transaction history available for analysis.';
    }

    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    const firstTransaction = sortedTransactions[0];
    const lastTransaction = sortedTransactions[sortedTransactions.length - 1];
    const totalTransactions = transactions.length;

    const avgTimeBetween = totalTransactions > 1
      ? (new Date(lastTransaction.transactionDate).getTime() - 
         new Date(firstTransaction.transactionDate).getTime()) / 
        (totalTransactions - 1) / (1000 * 60 * 60 * 24 * 365)
      : 0;

    return `Analyzed ${totalTransactions} transactions from ${firstTransaction.transactionDate} to ${lastTransaction.transactionDate}. Average time between transactions: ${avgTimeBetween.toFixed(1)} years.`;
  }

  private determineOverallRisk(alerts: FraudAlert[]): RiskLevel {
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const highCount = alerts.filter(a => a.severity === 'high').length;
    const mediumCount = alerts.filter(a => a.severity === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount >= 2) return 'critical';
    if (highCount >= 1) return 'high';
    if (mediumCount >= 3) return 'high';
    if (mediumCount >= 1) return 'medium';
    return 'low';
  }
}
