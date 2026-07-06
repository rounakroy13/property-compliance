// ============================================
// Compliance Agent
// Verifies zoning rules, environmental restrictions, tax compliance
// ============================================

import { BaseAgent, AgentConfig } from './BaseAgent.js';
import type { 
  AgentTaskResult, 
  Property, 
  ComplianceStatus,
  ComplianceCheck,
  ComplianceRule,
  TaxRecord
} from '../types/index.js';

interface ComplianceInput {
  property: Property;
  complianceRules?: ComplianceRule[];
  taxRecords?: TaxRecord[];
  zoningData?: ZoningData;
}

interface ZoningData {
  zone: string;
  allowedUsage: string[];
  restrictions: string[];
  setbackRequirements?: {
    front: number;
    back: number;
    sides: number;
  };
  maxHeight?: number;
  maxCoverage?: number;
}

const agentConfig: AgentConfig = {
  name: 'Compliance Agent',
  description: 'Verifies zoning rules, environmental restrictions, municipal approvals, and tax compliance',
  capabilities: [
    'Verify zoning compliance',
    'Check environmental clearances',
    'Validate municipal approvals',
    'Verify tax payment status',
    'Check building permit compliance',
    'Assess regulatory requirements'
  ],
  maxRetries: 3,
  timeout: 30000,
};

export class ComplianceAgent extends BaseAgent {
  constructor() {
    super('compliance', agentConfig);
  }

  protected async onInitialize(): Promise<void> {
    console.log('[ComplianceAgent] Loading compliance rules and regulations...');
  }

  protected async process(input: Record<string, unknown>): Promise<AgentTaskResult> {
    const typedInput = input as unknown as ComplianceInput;
    const { property, complianceRules, taxRecords, zoningData } = typedInput;

    const checks: ComplianceCheck[] = [];
    const recommendations: Array<{ priority: 'high' | 'medium' | 'low'; action: string }> = [];

    // 1. Zoning Compliance Check
    const zoningCheck = await this.checkZoningCompliance(property, zoningData);
    checks.push(zoningCheck);

    // 2. Tax Compliance Check
    const taxCheck = await this.checkTaxCompliance(property, taxRecords);
    checks.push(taxCheck);

    // 3. Environmental Compliance Check
    const environmentalCheck = await this.checkEnvironmentalCompliance(property, complianceRules);
    checks.push(environmentalCheck);

    // 4. Municipal Approvals Check
    const municipalCheck = await this.checkMunicipalApprovals(property);
    checks.push(municipalCheck);

    // 5. Building Regulations Check
    const buildingCheck = await this.checkBuildingRegulations(property);
    checks.push(buildingCheck);

    // 6. Document Compliance Check
    const documentCheck = await this.checkDocumentCompliance(property);
    checks.push(documentCheck);

    // Calculate compliance status
    const complianceStatus = this.calculateComplianceStatus(checks);

    // Generate recommendations
    checks.forEach(check => {
      if (check.status === 'failed') {
        recommendations.push({
          priority: 'high',
          action: check.recommendation || `Resolve compliance issue: ${check.name}`
        });
      } else if (check.status === 'warning') {
        recommendations.push({
          priority: 'medium',
          action: check.recommendation || `Review compliance warning: ${check.name}`
        });
      }
    });

    const confidence = this.calculateConfidence(checks);

    const reasoning = this.generateReasoning(
      checks.map(c => `${c.name}: ${c.details} [${c.status.toUpperCase()}]`),
      `Compliance analysis complete. Status: ${complianceStatus.overall}. Score: ${complianceStatus.score}/${complianceStatus.maxScore}`
    );

    return {
      success: complianceStatus.overall === 'compliant',
      data: {
        complianceStatus,
        checks,
        complianceScore: complianceStatus.score,
        maxScore: complianceStatus.maxScore,
        checkedAt: new Date().toISOString(),
      },
      confidence,
      reasoning,
      recommendations: this.formatRecommendations(recommendations),
    };
  }

  private async checkZoningCompliance(property: Property, zoningData?: ZoningData): Promise<ComplianceCheck> {
    const baseCheck: ComplianceCheck = {
      id: 'ZONE-001',
      category: 'zoning',
      name: 'Zoning Compliance',
      description: 'Verification of property zoning and land use compliance',
      status: 'passed',
      details: '',
      regulationReference: 'Local Zoning Regulations'
    };

    if (!zoningData) {
      const isResidentialArea = property.district.toLowerCase().includes('residential') ||
                                property.address.toLowerCase().includes('colony') ||
                                property.address.toLowerCase().includes('nagar');

      if (isResidentialArea) {
        baseCheck.status = 'passed';
        baseCheck.details = 'Property located in residential zone. Land use compliant.';
      } else {
        baseCheck.status = 'warning';
        baseCheck.details = 'Zoning verification pending. Manual check recommended.';
        baseCheck.recommendation = 'Obtain zoning certificate from local authority';
      }
    } else {
      if (zoningData.allowedUsage.includes('residential')) {
        baseCheck.status = 'passed';
        baseCheck.details = `Zone: ${zoningData.zone}. Residential use permitted.`;
      } else {
        baseCheck.status = 'failed';
        baseCheck.details = `Zone: ${zoningData.zone}. Residential use not permitted.`;
        baseCheck.recommendation = 'Property cannot be used for residential purposes in this zone';
      }

      if (zoningData.restrictions.length > 0) {
        baseCheck.details += ` Restrictions: ${zoningData.restrictions.join(', ')}`;
      }
    }

    return baseCheck;
  }

  private async checkTaxCompliance(property: Property, taxRecords?: TaxRecord[]): Promise<ComplianceCheck> {
    const baseCheck: ComplianceCheck = {
      id: 'TAX-001',
      category: 'tax',
      name: 'Property Tax Compliance',
      description: 'Verification of property tax payment status',
      status: 'passed',
      details: '',
      regulationReference: 'Municipal Tax Regulations'
    };

    if (!taxRecords || taxRecords.length === 0) {
      baseCheck.status = 'warning';
      baseCheck.details = 'Tax records not available for verification';
      baseCheck.recommendation = 'Submit property tax receipts for the last 3 years';
      return baseCheck;
    }

    const currentYear = new Date().getFullYear();
    const recentRecords = taxRecords.filter(r => {
      const taxYear = parseInt(r.tax_year.split('-')[0]);
      return taxYear >= currentYear - 3;
    });

    const overdueRecords = recentRecords.filter(r => r.status === 'overdue');
    const pendingRecords = recentRecords.filter(r => r.status === 'pending');
    const paidRecords = recentRecords.filter(r => r.status === 'paid');

    if (overdueRecords.length > 0) {
      const totalOverdue = overdueRecords.reduce((sum, r) => sum + (r.tax_amount - r.paid_amount), 0);
      baseCheck.status = 'failed';
      baseCheck.details = `${overdueRecords.length} tax payment(s) overdue. Total due: ₹${totalOverdue.toLocaleString()}`;
      baseCheck.recommendation = 'Clear all overdue property taxes before proceeding';
    } else if (pendingRecords.length > 0) {
      const totalPending = pendingRecords.reduce((sum, r) => sum + (r.tax_amount - r.paid_amount), 0);
      baseCheck.status = 'warning';
      baseCheck.details = `${pendingRecords.length} tax payment(s) pending. Amount due: ₹${totalPending.toLocaleString()}`;
      baseCheck.recommendation = 'Clear pending tax payments to ensure compliance';
    } else {
      baseCheck.status = 'passed';
      baseCheck.details = `All property taxes paid. ${paidRecords.length} records verified.`;
    }

    return baseCheck;
  }

  private async checkEnvironmentalCompliance(property: Property, complianceRules?: ComplianceRule[]): Promise<ComplianceCheck> {
    const baseCheck: ComplianceCheck = {
      id: 'ENV-001',
      category: 'environmental',
      name: 'Environmental Compliance',
      description: 'Verification of environmental clearances and restrictions',
      status: 'passed',
      details: '',
      regulationReference: 'Environmental Protection Act'
    };

    const areaInSqft = this.convertToSqft(property.plotArea, property.plotAreaUnit);
    
    if (areaInSqft > 20000) {
      const hasEnvironmentalDoc = property.documents.some(
        doc => doc.type === 'environmental_clearance' && doc.status === 'verified'
      );

      if (hasEnvironmentalDoc) {
        baseCheck.status = 'passed';
        baseCheck.details = 'Environmental clearance certificate verified';
      } else {
        baseCheck.status = 'warning';
        baseCheck.details = 'Large property may require environmental clearance';
        baseCheck.recommendation = 'Obtain environmental clearance certificate if required';
      }
    } else {
      baseCheck.status = 'passed';
      baseCheck.details = 'Property size below threshold for mandatory environmental clearance';
    }

    if (complianceRules) {
      const envRules = complianceRules.filter(r => r.category === 'environmental');
      const applicableRules = envRules.filter(r => 
        r.applicable_zones.includes(property.district) ||
        r.applicable_zones.includes('all')
      );

      if (applicableRules.length > 0) {
        baseCheck.details += `. ${applicableRules.length} environmental regulations applicable.`;
      }
    }

    return baseCheck;
  }

  private async checkMunicipalApprovals(property: Property): Promise<ComplianceCheck> {
    const baseCheck: ComplianceCheck = {
      id: 'MUN-001',
      category: 'municipal',
      name: 'Municipal Approvals',
      description: 'Verification of municipal approvals and NOCs',
      status: 'passed',
      details: '',
      regulationReference: 'Municipal Corporation Rules'
    };

    const requiredDocs = ['building_permit', 'sale_deed'];
    const missingDocs: string[] = [];

    requiredDocs.forEach(docType => {
      const hasDoc = property.documents.some(
        doc => doc.type === docType && (doc.status === 'verified' || doc.status === 'extracted')
      );
      if (!hasDoc) {
        missingDocs.push(docType.replace('_', ' '));
      }
    });

    if (missingDocs.length > 0) {
      baseCheck.status = 'warning';
      baseCheck.details = `Missing documents: ${missingDocs.join(', ')}`;
      baseCheck.recommendation = `Submit required documents: ${missingDocs.join(', ')}`;
    } else {
      baseCheck.status = 'passed';
      baseCheck.details = 'All required municipal approvals and documents verified';
    }

    return baseCheck;
  }

  private async checkBuildingRegulations(property: Property): Promise<ComplianceCheck> {
    const baseCheck: ComplianceCheck = {
      id: 'BLD-001',
      category: 'building',
      name: 'Building Regulations',
      description: 'Verification of building code compliance',
      status: 'passed',
      details: '',
      regulationReference: 'Building Bye-Laws'
    };

    const hasBuildingPermit = property.documents.some(
      doc => doc.type === 'building_permit' && doc.status === 'verified'
    );

    if (!hasBuildingPermit) {
      baseCheck.status = 'warning';
      baseCheck.details = 'Building permit not verified';
      baseCheck.recommendation = 'Submit approved building plan and permit';
    } else {
      baseCheck.status = 'passed';
      baseCheck.details = 'Building permit verified';
    }

    return baseCheck;
  }

  private async checkDocumentCompliance(property: Property): Promise<ComplianceCheck> {
    const baseCheck: ComplianceCheck = {
      id: 'DOC-001',
      category: 'legal',
      name: 'Document Compliance',
      description: 'Verification of essential property documents',
      status: 'passed',
      details: '',
      regulationReference: 'Registration Act'
    };

    const essentialDocs = [
      { type: 'sale_deed', name: 'Sale Deed' },
      { type: 'encumbrance_certificate', name: 'Encumbrance Certificate' },
      { type: 'tax_receipt', name: 'Tax Receipt' },
    ];

    const documentStatus: string[] = [];
    let missingCount = 0;

    essentialDocs.forEach(doc => {
      const propertyDoc = property.documents.find(d => d.type === doc.type);
      if (propertyDoc) {
        if (propertyDoc.status === 'verified') {
          documentStatus.push(`${doc.name}: Verified ✓`);
        } else {
          documentStatus.push(`${doc.name}: ${propertyDoc.status}`);
        }
      } else {
        documentStatus.push(`${doc.name}: Missing`);
        missingCount++;
      }
    });

    if (missingCount > 0) {
      baseCheck.status = 'failed';
      baseCheck.details = `${missingCount} essential document(s) missing. ${documentStatus.join('; ')}`;
      baseCheck.recommendation = 'Submit all essential property documents';
    } else {
      baseCheck.status = 'passed';
      baseCheck.details = `All essential documents present. ${documentStatus.join('; ')}`;
    }

    return baseCheck;
  }

  private convertToSqft(area: number, unit: Property['plotAreaUnit']): number {
    const conversions: Record<Property['plotAreaUnit'], number> = {
      sqft: 1,
      sqm: 10.764,
      acres: 43560,
      hectares: 107639,
    };
    return area * conversions[unit];
  }

  private calculateConfidence(checks: ComplianceCheck[]): number {
    const weights: Record<ComplianceCheck['status'], number> = {
      passed: 1.0,
      warning: 0.6,
      not_applicable: 1.0,
      failed: 0.0,
    };

    const totalWeight = checks.reduce((sum, c) => sum + weights[c.status], 0);
    return totalWeight / checks.length;
  }

  private calculateComplianceStatus(checks: ComplianceCheck[]): ComplianceStatus {
    const statusScores: Record<ComplianceCheck['status'], number> = {
      passed: 10,
      warning: 5,
      not_applicable: 10,
      failed: 0,
    };

    const totalScore = checks.reduce((sum, check) => sum + statusScores[check.status], 0);
    const maxScore = checks.length * 10;

    const failedCount = checks.filter(c => c.status === 'failed').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    let overall: ComplianceStatus['overall'];
    if (failedCount > 0) {
      overall = 'non_compliant';
    } else if (warningCount > 0) {
      overall = 'partially_compliant';
    } else {
      overall = 'compliant';
    }

    return {
      overall,
      checks,
      score: totalScore,
      maxScore,
      lastCheckedAt: new Date(),
    };
  }
}
