// ============================================
// Property Verification Agent
// Verifies ownership, matches land records, detects conflicts
// ============================================

import { BaseAgent, AgentConfig } from './BaseAgent.js';
import type { 
  AgentTaskResult, 
  Property, 
  LandRecord, 
  VerificationStatus,
  OwnershipRecord 
} from '../types/index.js';

interface PropertyVerificationInput {
  property: Property;
  landRecords?: LandRecord[];
  ownershipHistory?: OwnershipRecord[];
}

interface VerificationFinding {
  category: string;
  status: 'verified' | 'failed' | 'warning' | 'pending';
  message: string;
  details?: string;
}

const agentConfig: AgentConfig = {
  name: 'Property Verification Agent',
  description: 'Verifies property ownership, matches land records, and detects ownership conflicts',
  capabilities: [
    'Verify property ownership against land records',
    'Match survey numbers and property boundaries',
    'Detect ownership conflicts and discrepancies',
    'Validate property chain of title',
    'Cross-reference with government databases'
  ],
  maxRetries: 3,
  timeout: 30000,
};

export class PropertyVerificationAgent extends BaseAgent {
  constructor() {
    super('property_verification', agentConfig);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize connections to land record databases
    console.log('[PropertyVerificationAgent] Connecting to land records database...');
  }

  protected async process(input: Record<string, unknown>): Promise<AgentTaskResult> {
    const { property, landRecords, ownershipHistory } = input as PropertyVerificationInput;

    const findings: VerificationFinding[] = [];
    const recommendations: Array<{ priority: 'high' | 'medium' | 'low'; action: string }> = [];

    // 1. Verify Survey Number
    const surveyVerification = await this.verifySurveyNumber(property, landRecords);
    findings.push(surveyVerification);

    // 2. Verify Ownership
    const ownershipVerification = await this.verifyOwnership(property, landRecords);
    findings.push(ownershipVerification);

    // 3. Verify Property Boundaries
    const boundaryVerification = await this.verifyBoundaries(property, landRecords);
    findings.push(boundaryVerification);

    // 4. Check Ownership Chain
    const chainVerification = await this.verifyOwnershipChain(property, ownershipHistory);
    findings.push(chainVerification);

    // 5. Detect Conflicts
    const conflictCheck = await this.detectConflicts(property, landRecords);
    findings.push(conflictCheck);

    // Calculate overall verification status
    const verificationStatus = this.calculateVerificationStatus(findings);

    // Generate recommendations based on findings
    findings.forEach(finding => {
      if (finding.status === 'failed') {
        recommendations.push({
          priority: 'high',
          action: `Resolve ${finding.category}: ${finding.message}`
        });
      } else if (finding.status === 'warning') {
        recommendations.push({
          priority: 'medium',
          action: `Review ${finding.category}: ${finding.message}`
        });
      }
    });

    // Calculate confidence score
    const confidence = this.calculateConfidence(findings);

    // Generate reasoning
    const reasoning = this.generateReasoning(
      findings.map(f => `${f.category}: ${f.message} [${f.status.toUpperCase()}]`),
      `Property verification ${verificationStatus.overall}. Overall confidence: ${(confidence * 100).toFixed(1)}%`
    );

    return {
      success: verificationStatus.overall === 'verified',
      data: {
        verificationStatus,
        findings,
        surveyNumber: property.surveyNumber,
        ownerName: property.currentOwner.name,
        verifiedAt: new Date().toISOString(),
      },
      confidence,
      reasoning,
      recommendations: this.formatRecommendations(recommendations),
    };
  }

  private async verifySurveyNumber(
    property: Property, 
    landRecords?: LandRecord[]
  ): Promise<VerificationFinding> {
    // Simulate verification against land records database
    if (!landRecords || landRecords.length === 0) {
      return {
        category: 'Survey Number Verification',
        status: 'pending',
        message: 'Land records not available for verification',
        details: 'Unable to verify survey number without land records data'
      };
    }

    const matchingRecord = landRecords.find(
      record => record.survey_number === property.surveyNumber
    );

    if (matchingRecord) {
      return {
        category: 'Survey Number Verification',
        status: 'verified',
        message: `Survey number ${property.surveyNumber} verified in land records`,
        details: `District: ${matchingRecord.district}, State: ${matchingRecord.state}`
      };
    }

    return {
      category: 'Survey Number Verification',
      status: 'failed',
      message: `Survey number ${property.surveyNumber} not found in land records`,
      details: 'The provided survey number does not match any records in the database'
    };
  }

  private async verifyOwnership(
    property: Property, 
    landRecords?: LandRecord[]
  ): Promise<VerificationFinding> {
    if (!landRecords || landRecords.length === 0) {
      return {
        category: 'Ownership Verification',
        status: 'pending',
        message: 'Land records not available for ownership verification',
      };
    }

    const matchingRecord = landRecords.find(
      record => record.survey_number === property.surveyNumber
    );

    if (!matchingRecord) {
      return {
        category: 'Ownership Verification',
        status: 'failed',
        message: 'Property not found in land records',
      };
    }

    // Normalize names for comparison
    const normalizedRecordOwner = matchingRecord.owner_name.toLowerCase().trim();
    const normalizedPropertyOwner = property.currentOwner.name.toLowerCase().trim();

    if (normalizedRecordOwner === normalizedPropertyOwner) {
      return {
        category: 'Ownership Verification',
        status: 'verified',
        message: `Ownership verified for ${property.currentOwner.name}`,
        details: `Owner name matches land records exactly`
      };
    }

    // Check for partial match (could be same person with different name format)
    const recordNameParts = normalizedRecordOwner.split(' ');
    const propertyNameParts = normalizedPropertyOwner.split(' ');
    const hasPartialMatch = recordNameParts.some(part => 
      propertyNameParts.includes(part) && part.length > 2
    );

    if (hasPartialMatch) {
      return {
        category: 'Ownership Verification',
        status: 'warning',
        message: 'Partial name match found - manual verification recommended',
        details: `Land record shows: ${matchingRecord.owner_name}, Submitted: ${property.currentOwner.name}`
      };
    }

    return {
      category: 'Ownership Verification',
      status: 'failed',
      message: 'Owner name mismatch detected',
      details: `Land record shows: ${matchingRecord.owner_name}, Submitted: ${property.currentOwner.name}`
    };
  }

  private async verifyBoundaries(
    property: Property, 
    landRecords?: LandRecord[]
  ): Promise<VerificationFinding> {
    if (!landRecords || landRecords.length === 0) {
      return {
        category: 'Boundary Verification',
        status: 'pending',
        message: 'Land records not available for boundary verification',
      };
    }

    const matchingRecord = landRecords.find(
      record => record.survey_number === property.surveyNumber
    );

    if (!matchingRecord) {
      return {
        category: 'Boundary Verification',
        status: 'failed',
        message: 'Cannot verify boundaries - property not found',
      };
    }

    // Check if plot area matches within 5% tolerance
    const areaDifference = Math.abs(matchingRecord.plot_area - property.plotArea);
    const tolerance = matchingRecord.plot_area * 0.05;

    if (areaDifference <= tolerance) {
      return {
        category: 'Boundary Verification',
        status: 'verified',
        message: `Plot area verified: ${property.plotArea} ${property.plotAreaUnit}`,
        details: `Land record area: ${matchingRecord.plot_area} ${matchingRecord.plot_area_unit}`
      };
    }

    if (areaDifference <= matchingRecord.plot_area * 0.1) {
      return {
        category: 'Boundary Verification',
        status: 'warning',
        message: 'Minor area discrepancy detected',
        details: `Submitted: ${property.plotArea}, Records: ${matchingRecord.plot_area}`
      };
    }

    return {
      category: 'Boundary Verification',
      status: 'failed',
      message: 'Significant area mismatch detected',
      details: `Submitted: ${property.plotArea}, Records: ${matchingRecord.plot_area}`
    };
  }

  private async verifyOwnershipChain(
    property: Property, 
    ownershipHistory?: OwnershipRecord[]
  ): Promise<VerificationFinding> {
    const history = ownershipHistory || property.ownershipHistory;

    if (!history || history.length === 0) {
      return {
        category: 'Chain of Title',
        status: 'warning',
        message: 'Ownership history not available',
        details: 'Unable to verify complete chain of title'
      };
    }

    // Check for gaps in ownership history
    let hasGaps = false;
    for (let i = 0; i < history.length - 1; i++) {
      if (history[i].toDate && history[i + 1].fromDate) {
        const endDate = new Date(history[i].toDate!);
        const startDate = new Date(history[i + 1].fromDate);
        const daysDiff = (startDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 30) {
          hasGaps = true;
          break;
        }
      }
    }

    if (hasGaps) {
      return {
        category: 'Chain of Title',
        status: 'warning',
        message: 'Gaps detected in ownership history',
        details: 'There are periods where ownership is unclear'
      };
    }

    return {
      category: 'Chain of Title',
      status: 'verified',
      message: `Complete chain of title with ${history.length} ownership records`,
      details: 'No gaps detected in ownership history'
    };
  }

  private async detectConflicts(
    property: Property, 
    landRecords?: LandRecord[]
  ): Promise<VerificationFinding> {
    // Check for multiple claims on the same property
    if (!landRecords) {
      return {
        category: 'Conflict Detection',
        status: 'pending',
        message: 'Unable to check for conflicts without land records',
      };
    }

    // Check if there are duplicate records for the same survey number
    const duplicateRecords = landRecords.filter(
      record => record.survey_number === property.surveyNumber
    );

    if (duplicateRecords.length > 1) {
      return {
        category: 'Conflict Detection',
        status: 'failed',
        message: 'Multiple ownership claims detected',
        details: `Found ${duplicateRecords.length} records for the same survey number`
      };
    }

    return {
      category: 'Conflict Detection',
      status: 'verified',
      message: 'No ownership conflicts detected',
      details: 'Single ownership record found for this property'
    };
  }

  private calculateVerificationStatus(findings: VerificationFinding[]): VerificationStatus {
    const hasFailures = findings.some(f => f.status === 'failed');
    const hasWarnings = findings.some(f => f.status === 'warning');
    const allVerified = findings.every(f => f.status === 'verified');

    let overall: VerificationStatus['overall'];
    if (hasFailures) {
      overall = 'failed';
    } else if (hasWarnings) {
      overall = 'requires_review';
    } else if (allVerified) {
      overall = 'verified';
    } else {
      overall = 'in_progress';
    }

    return {
      overall,
      ownershipVerified: findings.find(f => f.category === 'Ownership Verification')?.status === 'verified',
      documentsVerified: false, // To be updated by document agent
      taxesCleared: false, // To be updated by compliance agent
      noEncumbrance: findings.find(f => f.category === 'Conflict Detection')?.status === 'verified',
      zoningCompliant: false, // To be updated by compliance agent
      lastVerifiedAt: new Date(),
    };
  }

  private calculateConfidence(findings: VerificationFinding[]): number {
    const weights = {
      verified: 1.0,
      warning: 0.6,
      pending: 0.3,
      failed: 0.0,
    };

    const totalWeight = findings.reduce((sum, f) => sum + weights[f.status], 0);
    return totalWeight / findings.length;
  }
}