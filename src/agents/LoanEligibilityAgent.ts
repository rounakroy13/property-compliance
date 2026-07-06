// ============================================
// Loan Eligibility Agent
// Assesses applicant profile, verifies repayment capability, calculates eligibility
// ============================================

import { BaseAgent, AgentConfig } from './BaseAgent.js';
import type { 
  AgentTaskResult, 
  Property, 
  ApplicantInfo,
  LoanDetails,
  LoanEligibilityResult,
  EligibilityFactor,
  LoanPolicy
} from '../types/index.js';

interface LoanEligibilityInput {
  applicant: ApplicantInfo;
  property: Property;
  loanDetails: LoanDetails;
  loanPolicies?: LoanPolicy[];
  propertyValue?: number;
}

const agentConfig: AgentConfig = {
  name: 'Loan Eligibility Agent',
  description: 'Assesses applicant profile, verifies repayment capability, and calculates loan eligibility',
  capabilities: [
    'Assess applicant financial profile',
    'Calculate loan eligibility',
    'Determine maximum loan amount',
    'Calculate EMI and affordability',
    'Evaluate Loan-to-Value (LTV) ratio',
    'Assess Fixed Obligations to Income Ratio (FOIR)',
    'Generate loan recommendations'
  ],
  maxRetries: 3,
  timeout: 30000,
};

export class LoanEligibilityAgent extends BaseAgent {
  // Default loan parameters
  private readonly DEFAULT_INTEREST_RATE = 8.5; // Annual percentage
  private readonly DEFAULT_MAX_LTV = 0.80; // 80% of property value
  private readonly DEFAULT_MAX_FOIR = 0.50; // 50% of income
  private readonly MIN_CREDIT_SCORE = 650;
  private readonly PREFERRED_CREDIT_SCORE = 750;

  constructor() {
    super('loan_eligibility', agentConfig);
  }

  protected async onInitialize(): Promise<void> {
    console.log('[LoanEligibilityAgent] Loading loan policies and eligibility rules...');
  }

  protected async process(input: Record<string, unknown>): Promise<AgentTaskResult> {
    const typedInput = input as unknown as LoanEligibilityInput;
    const { applicant, property, loanDetails, loanPolicies, propertyValue } = typedInput;

    const recommendations: Array<{ priority: 'high' | 'medium' | 'low'; action: string }> = [];
    const factors: EligibilityFactor[] = [];

    // Get applicable loan policy
    const policy = this.getApplicableLoanPolicy(loanDetails, loanPolicies);

    // 1. Assess Income Eligibility
    const incomeAssessment = this.assessIncomeEligibility(applicant, loanDetails, policy);
    factors.push(incomeAssessment);

    // 2. Assess Credit Score
    const creditAssessment = this.assessCreditScore(applicant, policy);
    factors.push(creditAssessment);

    // 3. Calculate LTV
    const estimatedPropertyValue = propertyValue || this.estimatePropertyValue(property);
    const ltvAssessment = this.assessLTV(loanDetails.requestedAmount, estimatedPropertyValue, policy);
    factors.push(ltvAssessment);

    // 4. Calculate FOIR (Fixed Obligations to Income Ratio)
    const foirAssessment = this.assessFOIR(applicant, loanDetails, policy);
    factors.push(foirAssessment);

    // 5. Assess Employment Stability
    const employmentAssessment = this.assessEmploymentStability(applicant, policy);
    factors.push(employmentAssessment);

    // 6. Assess Age Eligibility
    const ageAssessment = this.assessAgeEligibility(applicant, loanDetails);
    factors.push(ageAssessment);

    // Calculate eligibility result
    const eligibilityResult = this.calculateEligibility(
      applicant,
      loanDetails,
      factors,
      estimatedPropertyValue,
      policy
    );

    // Generate recommendations based on factors
    factors.forEach(factor => {
      if (factor.status === 'negative') {
        recommendations.push({
          priority: 'high',
          action: factor.impact
        });
      } else if (factor.status === 'neutral') {
        recommendations.push({
          priority: 'medium',
          action: factor.impact
        });
      }
    });

    // Add general recommendations
    if (!eligibilityResult.eligible) {
      recommendations.push({
        priority: 'high',
        action: 'Consider reducing loan amount or increasing down payment'
      });
    }

    if (eligibilityResult.restrictions && eligibilityResult.restrictions.length > 0) {
      eligibilityResult.restrictions.forEach(restriction => {
        recommendations.push({
          priority: 'medium',
          action: restriction
        });
      });
    }

    const confidence = this.calculateConfidence(factors);

    const reasoning = this.generateReasoning(
      factors.map(f => `${f.name}: ${f.value} [${f.status.toUpperCase()}] - ${f.impact}`),
      eligibilityResult.eligible 
        ? `Loan APPROVED. Maximum eligible amount: ₹${eligibilityResult.maxLoanAmount.toLocaleString()}. Estimated EMI: ₹${Math.round(eligibilityResult.estimatedEMI).toLocaleString()}`
        : `Loan NOT ELIGIBLE. ${factors.filter(f => f.status === 'negative').map(f => f.impact).join('. ')}`
    );

    return {
      success: eligibilityResult.eligible,
      data: {
        eligibilityResult,
        applicantName: applicant.name,
        requestedAmount: loanDetails.requestedAmount,
        maxEligibleAmount: eligibilityResult.maxLoanAmount,
        interestRate: eligibilityResult.interestRate,
        estimatedEMI: eligibilityResult.estimatedEMI,
        assessedAt: new Date().toISOString(),
      },
      confidence,
      reasoning,
      recommendations: this.formatRecommendations(recommendations),
    };
  }

  private getApplicableLoanPolicy(
    loanDetails: LoanDetails,
    policies?: LoanPolicy[]
  ): LoanPolicy | null {
    if (!policies || policies.length === 0) return null;

    return policies.find(p => 
      p.loan_type === loanDetails.purpose &&
      loanDetails.requestedAmount >= p.min_amount &&
      loanDetails.requestedAmount <= p.max_amount
    ) || null;
  }

  private assessIncomeEligibility(
    applicant: ApplicantInfo,
    loanDetails: LoanDetails,
    policy: LoanPolicy | null
  ): EligibilityFactor {
    const monthlyIncome = applicant.financials.monthlyIncome;
    const existingEMIs = applicant.financials.existingEMIs;
    const availableIncome = monthlyIncome - existingEMIs;

    // Calculate maximum affordable EMI (typically 40-50% of available income)
    const maxAffordableEMI = availableIncome * 0.45;

    // Calculate EMI for requested loan
    const interestRate = policy?.base_interest_rate || this.DEFAULT_INTEREST_RATE;
    const requestedEMI = this.calculateEMI(
      loanDetails.requestedAmount,
      interestRate,
      loanDetails.tenure
    );

    const canAfford = requestedEMI <= maxAffordableEMI;
    const affordabilityRatio = (requestedEMI / monthlyIncome) * 100;

    return {
      name: 'Income Assessment',
      value: `₹${monthlyIncome.toLocaleString()}/month`,
      status: canAfford ? 'positive' : 'negative',
      impact: canAfford 
        ? `Monthly income sufficient. EMI to income ratio: ${affordabilityRatio.toFixed(1)}%`
        : `Requested EMI (₹${Math.round(requestedEMI).toLocaleString()}) exceeds affordable limit (₹${Math.round(maxAffordableEMI).toLocaleString()})`,
      weight: 0.25
    };
  }

  private assessCreditScore(
    applicant: ApplicantInfo,
    policy: LoanPolicy | null
  ): EligibilityFactor {
    const creditScore = applicant.financials.creditScore;
    const minRequired = policy?.min_credit_score || this.MIN_CREDIT_SCORE;

    if (!creditScore) {
      return {
        name: 'Credit Score',
        value: 'Not Available',
        status: 'neutral',
        impact: 'Credit score not provided. Verification required.',
        weight: 0.20
      };
    }

    let status: 'positive' | 'negative' | 'neutral';
    let impact: string;

    if (creditScore >= this.PREFERRED_CREDIT_SCORE) {
      status = 'positive';
      impact = `Excellent credit score. Eligible for best interest rates.`;
    } else if (creditScore >= minRequired) {
      status = 'neutral';
      impact = `Credit score acceptable but below preferred level (${this.PREFERRED_CREDIT_SCORE}). May affect interest rate.`;
    } else {
      status = 'negative';
      impact = `Credit score below minimum requirement (${minRequired}). Loan eligibility affected.`;
    }

    return {
      name: 'Credit Score',
      value: creditScore,
      status,
      impact,
      weight: 0.20
    };
  }

  private assessLTV(
    requestedAmount: number,
    propertyValue: number,
    policy: LoanPolicy | null
  ): EligibilityFactor {
    const maxLTV = policy?.max_ltv || this.DEFAULT_MAX_LTV;
    const currentLTV = requestedAmount / propertyValue;
    const maxLoanByLTV = propertyValue * maxLTV;

    let status: 'positive' | 'negative' | 'neutral';
    let impact: string;

    if (currentLTV <= maxLTV * 0.8) {
      status = 'positive';
      impact = `LTV ratio (${(currentLTV * 100).toFixed(1)}%) well within limits. Good equity buffer.`;
    } else if (currentLTV <= maxLTV) {
      status = 'neutral';
      impact = `LTV ratio (${(currentLTV * 100).toFixed(1)}%) acceptable but close to maximum (${(maxLTV * 100).toFixed(0)}%).`;
    } else {
      status = 'negative';
      impact = `LTV ratio (${(currentLTV * 100).toFixed(1)}%) exceeds maximum allowed (${(maxLTV * 100).toFixed(0)}%). Increase down payment by ₹${Math.round(requestedAmount - maxLoanByLTV).toLocaleString()}.`;
    }

    return {
      name: 'Loan-to-Value (LTV)',
      value: `${(currentLTV * 100).toFixed(1)}%`,
      status,
      impact,
      weight: 0.15
    };
  }

  private assessFOIR(
    applicant: ApplicantInfo,
    loanDetails: LoanDetails,
    policy: LoanPolicy | null
  ): EligibilityFactor {
    const maxFOIR = policy?.max_foir || this.DEFAULT_MAX_FOIR;
    const monthlyIncome = applicant.financials.monthlyIncome;
    const existingEMIs = applicant.financials.existingEMIs;
    
    const interestRate = policy?.base_interest_rate || this.DEFAULT_INTEREST_RATE;
    const newEMI = this.calculateEMI(loanDetails.requestedAmount, interestRate, loanDetails.tenure);
    
    const totalObligations = existingEMIs + newEMI;
    const foir = totalObligations / monthlyIncome;

    let status: 'positive' | 'negative' | 'neutral';
    let impact: string;

    if (foir <= maxFOIR * 0.8) {
      status = 'positive';
      impact = `FOIR (${(foir * 100).toFixed(1)}%) is healthy. Good repayment capacity.`;
    } else if (foir <= maxFOIR) {
      status = 'neutral';
      impact = `FOIR (${(foir * 100).toFixed(1)}%) acceptable but close to maximum (${(maxFOIR * 100).toFixed(0)}%).`;
    } else {
      status = 'negative';
      impact = `FOIR (${(foir * 100).toFixed(1)}%) exceeds maximum allowed (${(maxFOIR * 100).toFixed(0)}%). Reduce loan amount or clear existing loans.`;
    }

    return {
      name: 'Fixed Obligations to Income Ratio (FOIR)',
      value: `${(foir * 100).toFixed(1)}%`,
      status,
      impact,
      weight: 0.20
    };
  }

  private assessEmploymentStability(
    applicant: ApplicantInfo,
    policy: LoanPolicy | null
  ): EligibilityFactor {
    const employment = applicant.employment;
    
    let yearsOfExperience = 0;
    if (employment.type === 'salaried' && employment.yearsInService) {
      yearsOfExperience = employment.yearsInService;
    } else if ((employment.type === 'self_employed' || employment.type === 'business') && employment.yearsInBusiness) {
      yearsOfExperience = employment.yearsInBusiness;
    }

    // Check if employment type is eligible
    const eligibleTypes = policy?.eligible_employment_types || ['salaried', 'self_employed', 'business'];
    const isEligibleType = eligibleTypes.includes(employment.type);

    let status: 'positive' | 'negative' | 'neutral';
    let impact: string;

    if (!isEligibleType) {
      status = 'negative';
      impact = `Employment type (${employment.type}) not eligible for this loan product.`;
    } else if (yearsOfExperience >= 5) {
      status = 'positive';
      impact = `Stable employment history (${yearsOfExperience} years). Good stability indicator.`;
    } else if (yearsOfExperience >= 2) {
      status = 'neutral';
      impact = `Employment history (${yearsOfExperience} years) acceptable. Minimum requirement met.`;
    } else {
      status = 'negative';
      impact = `Employment history (${yearsOfExperience} years) below preferred minimum (2 years).`;
    }

    return {
      name: 'Employment Stability',
      value: `${employment.type} - ${yearsOfExperience} years`,
      status,
      impact,
      weight: 0.10
    };
  }

  private assessAgeEligibility(
    applicant: ApplicantInfo,
    loanDetails: LoanDetails
  ): EligibilityFactor {
    const birthDate = new Date(applicant.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const ageAtLoanEnd = age + loanDetails.tenure / 12;

    // Typical retirement age consideration
    const maxAgeAtLoanEnd = 65;

    let status: 'positive' | 'negative' | 'neutral';
    let impact: string;

    if (age < 21) {
      status = 'negative';
      impact = `Age (${age}) below minimum requirement (21 years).`;
    } else if (ageAtLoanEnd > maxAgeAtLoanEnd) {
      status = 'negative';
      impact = `Age at loan maturity (${Math.round(ageAtLoanEnd)}) exceeds maximum (${maxAgeAtLoanEnd}). Consider shorter tenure.`;
    } else if (age >= 21 && age <= 55) {
      status = 'positive';
      impact = `Age (${age}) is within ideal range for home loan.`;
    } else {
      status = 'neutral';
      impact = `Age (${age}) acceptable but closer to upper limit.`;
    }

    return {
      name: 'Age Eligibility',
      value: `${age} years`,
      status,
      impact,
      weight: 0.10
    };
  }

  private estimatePropertyValue(property: Property): number {
    // Base value estimation based on location and area
    const areaInSqft = this.convertToSqft(property.plotArea, property.plotAreaUnit);
    
    // Average rate per sqft based on location type (simplified)
    let ratePerSqft = 5000; // Default rate
    
    const address = property.address.toLowerCase();
    if (address.includes('metro') || address.includes('mumbai') || address.includes('delhi') || address.includes('bangalore')) {
      ratePerSqft = 15000;
    } else if (address.includes('city') || address.includes('nagar') || address.includes('urban')) {
      ratePerSqft = 8000;
    } else if (address.includes('town')) {
      ratePerSqft = 5000;
    } else {
      ratePerSqft = 3000;
    }

    return areaInSqft * ratePerSqft;
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

  private calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    const monthlyRate = annualRate / 12 / 100;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / 
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return emi;
  }

  private calculateConfidence(factors: EligibilityFactor[]): number {
    const positiveCount = factors.filter(f => f.status === 'positive').length;
    const neutralCount = factors.filter(f => f.status === 'neutral').length;
    const negativeCount = factors.filter(f => f.status === 'negative').length;

    const weightedScore = (positiveCount * 1.0 + neutralCount * 0.6 + negativeCount * 0.2) / factors.length;
    return weightedScore;
  }

  private calculateEligibility(
    applicant: ApplicantInfo,
    loanDetails: LoanDetails,
    factors: EligibilityFactor[],
    propertyValue: number,
    policy: LoanPolicy | null
  ): LoanEligibilityResult {
    const negativeFactors = factors.filter(f => f.status === 'negative');
    const hasBlockingFactor = negativeFactors.some(f => f.weight >= 0.20);

    // Calculate max loan based on various constraints
    const interestRate = policy?.base_interest_rate || this.DEFAULT_INTEREST_RATE;
    const maxLTV = policy?.max_ltv || this.DEFAULT_MAX_LTV;
    const maxFOIR = policy?.max_foir || this.DEFAULT_MAX_FOIR;

    // Max by LTV
    const maxByLTV = propertyValue * maxLTV;

    // Max by income (based on FOIR)
    const availableForEMI = (applicant.financials.monthlyIncome * maxFOIR) - applicant.financials.existingEMIs;
    const maxByIncome = this.calculateMaxPrincipal(availableForEMI, interestRate, loanDetails.tenure);

    // Max by policy limits
    const maxByPolicy = policy?.max_amount || Infinity;

    // Final max is minimum of all constraints
    const maxLoanAmount = Math.min(maxByLTV, maxByIncome, maxByPolicy);

    // Calculate actual EMI for requested amount
    const estimatedEMI = this.calculateEMI(
      Math.min(loanDetails.requestedAmount, maxLoanAmount),
      interestRate,
      loanDetails.tenure
    );

    // Calculate ratios
    const ltv = loanDetails.requestedAmount / propertyValue;
    const dti = (applicant.financials.existingEMIs + estimatedEMI) / applicant.financials.monthlyIncome;
    const foir = dti;

    // Determine eligibility
    const eligible = !hasBlockingFactor && 
                     loanDetails.requestedAmount <= maxLoanAmount &&
                     negativeFactors.length <= 1;

    // Determine restrictions
    const restrictions: string[] = [];
    if (loanDetails.requestedAmount > maxLoanAmount) {
      restrictions.push(`Reduce loan amount to ₹${Math.round(maxLoanAmount).toLocaleString()} or less`);
    }
    if (applicant.financials.creditScore && applicant.financials.creditScore < this.PREFERRED_CREDIT_SCORE) {
      restrictions.push('Interest rate may be higher due to credit score');
    }

    return {
      eligible,
      maxLoanAmount: Math.round(maxLoanAmount),
      recommendedTenure: this.recommendTenure(applicant, loanDetails, maxLoanAmount, interestRate),
      interestRate,
      estimatedEMI: Math.round(estimatedEMI),
      ltv,
      dti,
      foir,
      factors,
      restrictions: restrictions.length > 0 ? restrictions : undefined,
    };
  }

  private calculateMaxPrincipal(maxEMI: number, annualRate: number, tenureMonths: number): number {
    const monthlyRate = annualRate / 12 / 100;
    const principal = (maxEMI * (Math.pow(1 + monthlyRate, tenureMonths) - 1)) / 
                      (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));
    return principal;
  }

  private recommendTenure(
    applicant: ApplicantInfo,
    loanDetails: LoanDetails,
    maxLoanAmount: number,
    interestRate: number
  ): number {
    const birthDate = new Date(applicant.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    
    // Max tenure based on retirement age
    const maxTenureByAge = (65 - age) * 12;
    
    // Preferred tenure range
    const preferredMaxTenure = 240; // 20 years
    const preferredMinTenure = 60;  // 5 years
    
    // Calculate tenure that keeps EMI affordable
    const targetEMI = (applicant.financials.monthlyIncome - applicant.financials.existingEMIs) * 0.4;
    const loanAmount = Math.min(loanDetails.requestedAmount, maxLoanAmount);
    
    // Binary search for optimal tenure
    let optimalTenure = loanDetails.tenure;
    for (let tenure = preferredMinTenure; tenure <= Math.min(maxTenureByAge, preferredMaxTenure); tenure += 12) {
      const emi = this.calculateEMI(loanAmount, interestRate, tenure);
      if (emi <= targetEMI) {
        optimalTenure = tenure;
        break;
      }
    }
    
    return Math.min(optimalTenure, maxTenureByAge, preferredMaxTenure);
  }
}
