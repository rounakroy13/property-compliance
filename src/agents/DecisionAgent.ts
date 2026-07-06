// ============================================
// Decision Agent (Gemini-powered)
// Aggregates outputs, generates explainable decisions, recommends next actions
// ============================================

import { BaseAgent, AgentConfig } from './BaseAgent.js';
import type { 
  AgentTaskResult,
  AgentTask,
  Property,
  LoanApplication,
  ComplianceReport,
  Decision,
  ReportSummary,
  Recommendation,
  VerificationStatus,
  ComplianceStatus,
  FraudAnalysis,
  RiskAssessment,
  LoanEligibilityResult,
  RiskLevel
} from '../types/index.js';

interface DecisionInput {
  property: Property;
  loanApplication?: LoanApplication;
  propertyVerificationResult?: AgentTask;
  complianceResult?: AgentTask;
  fraudDetectionResult?: AgentTask;
  loanEligibilityResult?: AgentTask;
}

interface DecisionFactors {
  propertyVerified: boolean;
  complianceScore: number;
  fraudRiskLevel: RiskLevel;
  loanEligible: boolean;
  overallRiskScore: number;
  blockingIssues: string[];
  warnings: string[];
}

const agentConfig: AgentConfig = {
  name: 'Decision Agent',
  description: 'AI-powered decision engine that aggregates all agent outputs and generates explainable decisions',
  capabilities: [
    'Aggregate multi-agent analysis results',
    'Generate comprehensive compliance reports',
    'Produce explainable AI decisions',
    'Calculate overall risk scores',
    'Recommend corrective actions',
    'Generate approval/rejection explanations'
  ],
  maxRetries: 3,
  timeout: 60000,
};

export class DecisionAgent extends BaseAgent {
  constructor() {
    super('decision', agentConfig);
  }

  protected async onInitialize(): Promise<void> {
    console.log('[DecisionAgent] Initializing decision engine...');
    // In production, this would initialize connection to Gemini API
  }

  protected async process(input: Record<string, unknown>): Promise<AgentTaskResult> {
    const typedInput = input as unknown as DecisionInput;
    const { 
      property, 
      loanApplication,
      propertyVerificationResult,
      complianceResult,
      fraudDetectionResult,
      loanEligibilityResult
    } = typedInput;

    // Extract data from agent results
    const verificationData = propertyVerificationResult?.result?.data as Record<string, unknown> | undefined;
    const complianceData = complianceResult?.result?.data as Record<string, unknown> | undefined;
    const fraudData = fraudDetectionResult?.result?.data as Record<string, unknown> | undefined;
    const eligibilityData = loanEligibilityResult?.result?.data as Record<string, unknown> | undefined;

    // Analyze decision factors
    const factors = this.analyzeDecisionFactors(
      verificationData,
      complianceData,
      fraudData,
      eligibilityData
    );

    // Generate decision
    const decision = this.generateDecision(factors, loanApplication);

    // Generate report summary
    const summary = this.generateReportSummary(factors, decision);

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, decision);

    // Calculate risk assessment
    const riskAssessment = this.calculateRiskAssessment(factors, fraudData);

    // Build compliance report
    const complianceReport: Partial<ComplianceReport> = {
      id: `RPT-${Date.now()}`,
      property,
      loanApplication,
      generatedAt: new Date(),
      summary,
      propertyVerification: verificationData?.verificationStatus as VerificationStatus,
      complianceAnalysis: complianceData?.complianceStatus as ComplianceStatus,
      fraudAnalysis: fraudData?.fraudAnalysis as FraudAnalysis,
      riskAssessment,
      loanEligibility: eligibilityData?.eligibilityResult as LoanEligibilityResult,
      decision,
      recommendations,
      auditTrail: [
        {
          timestamp: new Date(),
          action: 'Report Generated',
          actor: 'Decision Agent',
          details: 'Comprehensive compliance report generated with AI-powered analysis'
        }
      ]
    };

    // Generate explainable reasoning using AI
    const explanation = this.generateExplanation(factors, decision, recommendations);

    const confidence = this.calculateOverallConfidence(
      propertyVerificationResult,
      complianceResult,
      fraudDetectionResult,
      loanEligibilityResult
    );

    return {
      success: decision.status === 'approved' || decision.status === 'conditional',
      data: {
        complianceReport,
        decision,
        summary,
        riskAssessment,
        recommendations,
        generatedAt: new Date().toISOString(),
      },
      confidence,
      reasoning: explanation,
      recommendations: recommendations.map(r => `[${r.priority.toUpperCase()}] ${r.action}`),
    };
  }

  private analyzeDecisionFactors(
    verificationData?: Record<string, unknown>,
    complianceData?: Record<string, unknown>,
    fraudData?: Record<string, unknown>,
    eligibilityData?: Record<string, unknown>
  ): DecisionFactors {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    // Property verification status
    const verificationStatus = verificationData?.verificationStatus as VerificationStatus | undefined;
    const propertyVerified = verificationStatus?.overall === 'verified';
    if (!propertyVerified && verificationStatus) {
      if (verificationStatus.overall === 'failed') {
        blockingIssues.push('Property verification failed');
      } else if (verificationStatus.overall === 'requires_review') {
        warnings.push('Property verification requires manual review');
      }
    }

    // Compliance score
    const complianceStatus = complianceData?.complianceStatus as ComplianceStatus | undefined;
    const complianceScore = complianceStatus?.score || 0;
    const maxComplianceScore = complianceStatus?.maxScore || 100;
    const compliancePercentage = (complianceScore / maxComplianceScore) * 100;
    
    if (compliancePercentage < 50) {
      blockingIssues.push(`Compliance score too low (${compliancePercentage.toFixed(0)}%)`);
    } else if (compliancePercentage < 70) {
      warnings.push(`Compliance score below optimal (${compliancePercentage.toFixed(0)}%)`);
    }

    // Fraud risk level
    const fraudAnalysis = fraudData?.fraudAnalysis as FraudAnalysis | undefined;
    let fraudRiskLevel: RiskLevel = 'low';
    if (fraudAnalysis) {
      const highAlerts = fraudAnalysis.alerts.filter(a => 
        a.severity === 'high' || a.severity === 'critical'
      ).length;
      
      if (highAlerts > 0 || fraudAnalysis.isSuspicious) {
        fraudRiskLevel = 'high';
        blockingIssues.push('High fraud risk detected');
      } else if (fraudAnalysis.alerts.length > 0) {
        fraudRiskLevel = 'medium';
        warnings.push('Potential fraud indicators found');
      }
    }

    // Loan eligibility
    const eligibilityResult = eligibilityData?.eligibilityResult as LoanEligibilityResult | undefined;
    const loanEligible = eligibilityResult?.eligible || false;
    if (!loanEligible && eligibilityResult) {
      blockingIssues.push('Loan eligibility criteria not met');
    }

    // Calculate overall risk score (0-100, lower is better)
    let overallRiskScore = 0;
    
    // Verification contributes 25%
    if (!propertyVerified) overallRiskScore += 25;
    else if (verificationStatus?.overall === 'requires_review') overallRiskScore += 10;
    
    // Compliance contributes 25%
    overallRiskScore += Math.max(0, 25 - (compliancePercentage * 0.25));
    
    // Fraud risk contributes 30%
    if (fraudRiskLevel === 'high' || false) overallRiskScore += 30;
    else if (fraudRiskLevel === 'medium') overallRiskScore += 15;
    
    // Loan eligibility contributes 20%
    if (!loanEligible) overallRiskScore += 20;

    return {
      propertyVerified,
      complianceScore: compliancePercentage,
      fraudRiskLevel,
      loanEligible,
      overallRiskScore,
      blockingIssues,
      warnings
    };
  }

  private generateDecision(factors: DecisionFactors, loanApplication?: LoanApplication): Decision {
    const { blockingIssues, warnings, overallRiskScore, loanEligible } = factors;

    // Decision logic
    if (blockingIssues.length > 0) {
      // Check if issues require manual review or outright rejection
      const criticalIssues = blockingIssues.filter(i => 
        i.includes('fraud') || i.includes('failed')
      );

      if (criticalIssues.length > 0) {
        return {
          status: 'rejected',
          reason: 'Critical compliance or fraud issues detected',
          explanation: this.buildExplanation(blockingIssues, warnings),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        };
      }

      return {
        status: 'manual_review',
        reason: 'Issues require manual verification',
        explanation: this.buildExplanation(blockingIssues, warnings),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
    }

    if (warnings.length > 0 || overallRiskScore > 30) {
      return {
        status: 'conditional',
        reason: 'Approved with conditions',
        explanation: this.buildExplanation([], warnings),
        conditions: warnings.map(w => `Resolve: ${w}`),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      };
    }

    if (loanEligible || !loanApplication) {
      return {
        status: 'approved',
        reason: 'All compliance checks passed',
        explanation: 'Property and applicant meet all requirements. Loan eligibility confirmed. No fraud indicators detected. Transaction may proceed.',
        validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 180 days
      };
    }

    return {
      status: 'conditional',
      reason: 'Property compliant but loan eligibility needs review',
      explanation: 'Property compliance verified. Loan eligibility requires additional review.',
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    };
  }

  private buildExplanation(blockingIssues: string[], warnings: string[]): string {
    const parts: string[] = [];

    if (blockingIssues.length > 0) {
      parts.push('**Critical Issues:**');
      blockingIssues.forEach(issue => parts.push(`- ${issue}`));
    }

    if (warnings.length > 0) {
      parts.push('\n**Warnings:**');
      warnings.forEach(warning => parts.push(`- ${warning}`));
    }

    if (parts.length === 0) {
      return 'All checks passed successfully.';
    }

    return parts.join('\n');
  }

  private generateReportSummary(factors: DecisionFactors, decision: Decision): ReportSummary {
    const { propertyVerified, complianceScore, fraudRiskLevel, loanEligible, overallRiskScore } = factors;

    const keyFindings: string[] = [];
    const criticalIssues: string[] = [...factors.blockingIssues];

    // Key findings
    if (propertyVerified) {
      keyFindings.push('Property ownership and documentation verified');
    }
    
    keyFindings.push(`Compliance score: ${complianceScore.toFixed(0)}%`);
    keyFindings.push(`Fraud risk level: ${fraudRiskLevel}`);
    
    if (loanEligible) {
      keyFindings.push('Loan eligibility criteria met');
    }

    // Generate headline
    let headline: string;
    if (decision.status === 'approved') {
      headline = '✅ Property Compliant - Transaction Approved';
    } else if (decision.status === 'conditional') {
      headline = '⚠️ Conditional Approval - Action Required';
    } else if (decision.status === 'manual_review') {
      headline = '🔍 Manual Review Required';
    } else {
      headline = '❌ Application Rejected';
    }

    return {
      overallStatus: decision.status === 'manual_review' ? 'pending' : decision.status,
      headline,
      keyFindings,
      criticalIssues,
      score: Math.round(100 - overallRiskScore)
    };
  }

  private generateRecommendations(factors: DecisionFactors, decision: Decision): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Add recommendations based on blocking issues
    factors.blockingIssues.forEach(issue => {
      recommendations.push({
        priority: 'high',
        category: this.categorizeIssue(issue),
        action: this.generateAction(issue),
        rationale: `This issue must be resolved as it blocks approval: ${issue}`,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      });
    });

    // Add recommendations based on warnings
    factors.warnings.forEach(warning => {
      recommendations.push({
        priority: 'medium',
        category: this.categorizeIssue(warning),
        action: this.generateAction(warning),
        rationale: `Addressing this will improve the application: ${warning}`,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
    });

    // Add general recommendations based on scores
    if (factors.complianceScore < 80) {
      recommendations.push({
        priority: 'medium',
        category: 'compliance',
        action: 'Submit additional compliance documents to improve score',
        rationale: 'Higher compliance score reduces processing time and improves terms'
      });
    }

    if (decision.status === 'approved') {
      recommendations.push({
        priority: 'low',
        category: 'next-steps',
        action: 'Proceed with document signing and fund disbursement',
        rationale: 'All requirements met. Application ready for final processing.'
      });
    }

    return recommendations;
  }

  private categorizeIssue(issue: string): string {
    const lowerIssue = issue.toLowerCase();
    if (lowerIssue.includes('fraud')) return 'fraud-prevention';
    if (lowerIssue.includes('compliance') || lowerIssue.includes('score')) return 'compliance';
    if (lowerIssue.includes('verification') || lowerIssue.includes('property')) return 'verification';
    if (lowerIssue.includes('loan') || lowerIssue.includes('eligib')) return 'loan-eligibility';
    return 'general';
  }

  private generateAction(issue: string): string {
    const lowerIssue = issue.toLowerCase();
    
    if (lowerIssue.includes('fraud')) {
      return 'Conduct thorough document verification with issuing authorities';
    }
    if (lowerIssue.includes('compliance') && lowerIssue.includes('low')) {
      return 'Submit missing compliance documents and clear any pending violations';
    }
    if (lowerIssue.includes('verification') && lowerIssue.includes('failed')) {
      return 'Resubmit property documents and verify ownership records';
    }
    if (lowerIssue.includes('eligib')) {
      return 'Review loan parameters or provide additional income documentation';
    }
    if (lowerIssue.includes('review')) {
      return 'Schedule manual verification appointment with compliance officer';
    }
    
    return `Address the issue: ${issue}`;
  }

  private calculateRiskAssessment(
    factors: DecisionFactors,
    fraudData?: Record<string, unknown>
  ): RiskAssessment {
    const fraudAnalysis = fraudData?.fraudAnalysis as FraudAnalysis | undefined;
    
    const categories = [
      {
        name: 'Property Verification',
        score: factors.propertyVerified ? 90 : 30,
        maxScore: 100,
        factors: [{
          name: 'Ownership Verification',
          description: factors.propertyVerified ? 'Property ownership verified' : 'Property verification issues found',
          severity: factors.propertyVerified ? 'low' as RiskLevel : 'high' as RiskLevel,
          score: factors.propertyVerified ? 90 : 30
        }]
      },
      {
        name: 'Compliance',
        score: factors.complianceScore,
        maxScore: 100,
        factors: [{
          name: 'Compliance Score',
          description: `Compliance at ${factors.complianceScore.toFixed(0)}%`,
          severity: factors.complianceScore >= 70 ? 'low' as RiskLevel : factors.complianceScore >= 50 ? 'medium' as RiskLevel : 'high' as RiskLevel,
          score: factors.complianceScore
        }]
      },
      {
        name: 'Fraud Risk',
        score: factors.fraudRiskLevel === 'low' ? 90 : factors.fraudRiskLevel === 'medium' ? 50 : 20,
        maxScore: 100,
        factors: [{
          name: 'Fraud Detection',
          description: `Fraud risk level: ${factors.fraudRiskLevel}`,
          severity: factors.fraudRiskLevel,
          score: factors.fraudRiskLevel === 'low' ? 90 : factors.fraudRiskLevel === 'medium' ? 50 : 20
        }]
      },
      {
        name: 'Loan Eligibility',
        score: factors.loanEligible ? 85 : 40,
        maxScore: 100,
        factors: [{
          name: 'Eligibility Check',
          description: factors.loanEligible ? 'Loan eligibility confirmed' : 'Loan eligibility issues',
          severity: factors.loanEligible ? 'low' as RiskLevel : 'high' as RiskLevel,
          score: factors.loanEligible ? 85 : 40
        }]
      }
    ];

    const overallScore = Math.round(100 - factors.overallRiskScore);
    
    let riskLevel: RiskLevel;
    if (overallScore >= 80) riskLevel = 'low';
    else if (overallScore >= 60) riskLevel = 'medium';
    else if (overallScore >= 40) riskLevel = 'high';
    else riskLevel = 'critical';

    const flags = fraudAnalysis?.alerts.map(alert => ({
      type: 'fraud' as const,
      severity: alert.severity,
      description: alert.description,
      evidence: alert.evidence.join('; '),
      recommendation: alert.recommendation
    })) || [];

    return {
      overallScore,
      riskLevel,
      categories,
      flags,
      recommendation: this.getRiskRecommendation(riskLevel),
      assessedAt: new Date()
    };
  }

  private getRiskRecommendation(riskLevel: RiskLevel): string {
    switch (riskLevel) {
      case 'low':
        return 'Proceed with standard processing. All risk indicators are within acceptable limits.';
      case 'medium':
        return 'Enhanced due diligence recommended. Review flagged items before proceeding.';
      case 'high':
        return 'Comprehensive review required. Senior approval needed before proceeding.';
      case 'critical':
        return 'Application should not proceed without thorough investigation and resolution of all issues.';
    }
  }

  private generateExplanation(
    factors: DecisionFactors,
    decision: Decision,
    recommendations: Recommendation[]
  ): string {
    const sections: string[] = [];

    sections.push('## Compliance & Loan Validation Analysis Report');
    sections.push('');
    sections.push('### Decision Summary');
    sections.push(`**Status:** ${decision.status.toUpperCase()}`);
    sections.push(`**Reason:** ${decision.reason}`);
    sections.push('');

    sections.push('### Analysis Breakdown');
    sections.push('');
    sections.push(`1. **Property Verification:** ${factors.propertyVerified ? '✅ Verified' : '❌ Issues Found'}`);
    sections.push(`2. **Compliance Score:** ${factors.complianceScore.toFixed(0)}%`);
    sections.push(`3. **Fraud Risk Level:** ${factors.fraudRiskLevel.toUpperCase()}`);
    sections.push(`4. **Loan Eligibility:** ${factors.loanEligible ? '✅ Eligible' : '❌ Not Eligible'}`);
    sections.push(`5. **Overall Risk Score:** ${(100 - factors.overallRiskScore).toFixed(0)}/100`);
    sections.push('');

    if (factors.blockingIssues.length > 0) {
      sections.push('### Critical Issues Requiring Resolution');
      factors.blockingIssues.forEach((issue, i) => {
        sections.push(`${i + 1}. ${issue}`);
      });
      sections.push('');
    }

    if (factors.warnings.length > 0) {
      sections.push('### Warnings');
      factors.warnings.forEach((warning, i) => {
        sections.push(`${i + 1}. ${warning}`);
      });
      sections.push('');
    }

    if (recommendations.length > 0) {
      sections.push('### Recommended Actions');
      recommendations.slice(0, 5).forEach((rec, i) => {
        sections.push(`${i + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`);
      });
      sections.push('');
    }

    sections.push('### Conclusion');
    sections.push(decision.explanation);

    return sections.join('\n');
  }

  private calculateOverallConfidence(
    propertyVerificationResult?: AgentTask,
    complianceResult?: AgentTask,
    fraudDetectionResult?: AgentTask,
    loanEligibilityResult?: AgentTask
  ): number {
    const confidences: number[] = [];

    if (propertyVerificationResult?.result?.confidence) {
      confidences.push(propertyVerificationResult.result.confidence);
    }
    if (complianceResult?.result?.confidence) {
      confidences.push(complianceResult.result.confidence);
    }
    if (fraudDetectionResult?.result?.confidence) {
      confidences.push(fraudDetectionResult.result.confidence);
    }
    if (loanEligibilityResult?.result?.confidence) {
      confidences.push(loanEligibilityResult.result.confidence);
    }

    if (confidences.length === 0) return 0.5;

    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }
}
