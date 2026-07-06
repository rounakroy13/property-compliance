// ============================================
// Property Compliance & Loan Validation Types
// ============================================

// Document Types
export interface PropertyDocument {
  id: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  extractedData?: ExtractedDocumentData;
  status: DocumentStatus;
}

export type DocumentType = 
  | 'sale_deed'
  | 'encumbrance_certificate'
  | 'tax_receipt'
  | 'identity_proof'
  | 'income_proof'
  | 'bank_statement'
  | 'property_survey'
  | 'zoning_certificate'
  | 'environmental_clearance'
  | 'building_permit'
  | 'other';

export type DocumentStatus = 
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'verified'
  | 'failed';

export interface ExtractedDocumentData {
  ownerName?: string;
  propertyAddress?: string;
  surveyNumber?: string;
  plotArea?: string;
  registrationNumber?: string;
  registrationDate?: string;
  taxAmount?: number;
  taxYear?: string;
  boundaries?: PropertyBoundaries;
  rawText?: string;
  confidence: number;
  extractedFields: Record<string, string>;
}

export interface PropertyBoundaries {
  north: string;
  south: string;
  east: string;
  west: string;
}

// Property Types
export interface Property {
  id: string;
  surveyNumber: string;
  address: string;
  district: string;
  state: string;
  pincode: string;
  plotArea: number;
  plotAreaUnit: 'sqft' | 'sqm' | 'acres' | 'hectares';
  currentOwner: OwnerInfo;
  ownershipHistory: OwnershipRecord[];
  documents: PropertyDocument[];
  verificationStatus: VerificationStatus;
  complianceStatus: ComplianceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OwnerInfo {
  name: string;
  fatherName?: string;
  identityType: 'aadhaar' | 'pan' | 'passport' | 'voter_id';
  identityNumber: string;
  address: string;
  phone?: string;
  email?: string;
}

export interface OwnershipRecord {
  ownerName: string;
  fromDate: string;
  toDate?: string;
  transactionType: 'purchase' | 'inheritance' | 'gift' | 'court_order';
  documentReference: string;
}

// Verification Types
export interface VerificationStatus {
  overall: VerificationResult;
  ownershipVerified: boolean;
  documentsVerified: boolean;
  taxesCleared: boolean;
  noEncumbrance: boolean;
  zoningCompliant: boolean;
  lastVerifiedAt?: Date;
}

export type VerificationResult = 
  | 'pending'
  | 'in_progress'
  | 'verified'
  | 'failed'
  | 'requires_review';

// Compliance Types
export interface ComplianceStatus {
  overall: ComplianceResult;
  checks: ComplianceCheck[];
  score: number;
  maxScore: number;
  lastCheckedAt?: Date;
}

export type ComplianceResult = 
  | 'compliant'
  | 'non_compliant'
  | 'partially_compliant'
  | 'pending';

export interface ComplianceCheck {
  id: string;
  category: ComplianceCategory;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'not_applicable';
  details: string;
  recommendation?: string;
  regulationReference?: string;
}

export type ComplianceCategory = 
  | 'ownership'
  | 'legal'
  | 'tax'
  | 'zoning'
  | 'environmental'
  | 'municipal'
  | 'building';

// Loan Types
export interface LoanApplication {
  id: string;
  applicant: ApplicantInfo;
  property: Property;
  loanDetails: LoanDetails;
  status: LoanApplicationStatus;
  eligibilityResult?: LoanEligibilityResult;
  riskAssessment?: RiskAssessment;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicantInfo {
  name: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  identityType: 'aadhaar' | 'pan' | 'passport';
  identityNumber: string;
  email: string;
  phone: string;
  address: string;
  employment: EmploymentInfo;
  financials: FinancialInfo;
}

export interface EmploymentInfo {
  type: 'salaried' | 'self_employed' | 'business' | 'retired';
  employer?: string;
  designation?: string;
  yearsInService?: number;
  businessName?: string;
  businessType?: string;
  yearsInBusiness?: number;
}

export interface FinancialInfo {
  annualIncome: number;
  monthlyIncome: number;
  existingEMIs: number;
  existingLoans: ExistingLoan[];
  creditScore?: number;
  bankStatementAvailable: boolean;
  itrAvailable: boolean;
}

export interface ExistingLoan {
  type: string;
  lender: string;
  outstandingAmount: number;
  emi: number;
  remainingTenure: number;
}

export interface LoanDetails {
  requestedAmount: number;
  purpose: LoanPurpose;
  tenure: number;
  preferredInterestType: 'fixed' | 'floating';
  downPayment?: number;
}

export type LoanPurpose = 
  | 'purchase'
  | 'construction'
  | 'renovation'
  | 'refinance'
  | 'balance_transfer';

export type LoanApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'document_verification'
  | 'property_verification'
  | 'eligibility_check'
  | 'risk_assessment'
  | 'approved'
  | 'conditionally_approved'
  | 'rejected'
  | 'disbursed';

export interface LoanEligibilityResult {
  eligible: boolean;
  maxLoanAmount: number;
  recommendedTenure: number;
  interestRate: number;
  estimatedEMI: number;
  ltv: number;
  dti: number;
  foir: number;
  factors: EligibilityFactor[];
  restrictions?: string[];
}

export interface EligibilityFactor {
  name: string;
  value: number | string;
  status: 'positive' | 'negative' | 'neutral';
  impact: string;
  weight: number;
}

// Risk Assessment Types
export interface RiskAssessment {
  overallScore: number;
  riskLevel: RiskLevel;
  categories: RiskCategory[];
  flags: RiskFlag[];
  recommendation: string;
  assessedAt: Date;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskCategory {
  name: string;
  score: number;
  maxScore: number;
  factors: RiskFactor[];
}

export interface RiskFactor {
  name: string;
  description: string;
  severity: RiskLevel;
  score: number;
}

export interface RiskFlag {
  type: 'fraud' | 'compliance' | 'financial' | 'legal';
  severity: RiskLevel;
  description: string;
  evidence?: string;
  recommendation: string;
}

// Fraud Detection Types
export interface FraudAnalysis {
  isSuspicious: boolean;
  confidenceScore: number;
  alerts: FraudAlert[];
  documentAuthenticity: DocumentAuthenticityResult[];
  ownershipConsistency: boolean;
  transactionPatternAnalysis: string;
}

export interface FraudAlert {
  type: FraudAlertType;
  severity: RiskLevel;
  description: string;
  evidence: string[];
  recommendation: string;
}

export type FraudAlertType = 
  | 'forged_document'
  | 'ownership_mismatch'
  | 'suspicious_transaction'
  | 'identity_fraud'
  | 'multiple_ownership_claims'
  | 'price_manipulation'
  | 'document_tampering';

export interface DocumentAuthenticityResult {
  documentId: string;
  documentType: DocumentType;
  isAuthentic: boolean;
  confidenceScore: number;
  issues: string[];
}

// Agent Types
export interface AgentTask {
  id: string;
  agentType: AgentType;
  input: Record<string, unknown>;
  status: AgentTaskStatus;
  result?: AgentTaskResult;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export type AgentType = 
  | 'property_verification'
  | 'compliance'
  | 'fraud_detection'
  | 'loan_eligibility'
  | 'decision';

export type AgentTaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface AgentTaskResult {
  success: boolean;
  data: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  recommendations: string[];
}

// Chat Types
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  intent?: UserIntent;
  entities?: ExtractedEntity[];
  agentInvoked?: AgentType;
  processingTime?: number;
  sources?: string[];
}

export type UserIntent = 
  | 'property_verification'
  | 'loan_application'
  | 'compliance_check'
  | 'document_upload'
  | 'status_inquiry'
  | 'general_query'
  | 'help';

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface ChatSession {
  id: string;
  userId?: string;
  messages: ChatMessage[];
  context: ChatContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatContext {
  currentProperty?: Property;
  currentLoanApplication?: LoanApplication;
  userProfile?: ApplicantInfo;
  verificationInProgress?: boolean;
  awaitingDocuments?: DocumentType[];
  lastIntent?: UserIntent;
}

// Decision & Report Types
export interface ComplianceReport {
  id: string;
  property: Property;
  loanApplication?: LoanApplication;
  generatedAt: Date;
  summary: ReportSummary;
  propertyVerification: VerificationStatus;
  complianceAnalysis: ComplianceStatus;
  fraudAnalysis: FraudAnalysis;
  riskAssessment?: RiskAssessment;
  loanEligibility?: LoanEligibilityResult;
  decision: Decision;
  recommendations: Recommendation[];
  auditTrail: AuditEntry[];
}

export interface ReportSummary {
  overallStatus: 'approved' | 'rejected' | 'conditional' | 'pending';
  headline: string;
  keyFindings: string[];
  criticalIssues: string[];
  score: number;
}

export interface Decision {
  status: 'approved' | 'rejected' | 'conditional' | 'manual_review';
  reason: string;
  explanation: string;
  conditions?: string[];
  validUntil?: Date;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  action: string;
  rationale: string;
  deadline?: Date;
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  actor: string;
  details: string;
  dataSnapshot?: Record<string, unknown>;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMetadata {
  requestId: string;
  processingTime: number;
  timestamp: Date;
}

// BigQuery Data Types
export interface LandRecord {
  survey_number: string;
  district: string;
  state: string;
  owner_name: string;
  owner_father_name: string;
  plot_area: number;
  plot_area_unit: string;
  registration_number: string;
  registration_date: string;
  land_type: string;
  boundaries_north: string;
  boundaries_south: string;
  boundaries_east: string;
  boundaries_west: string;
  last_updated: string;
}

export interface TaxRecord {
  property_id: string;
  survey_number: string;
  tax_year: string;
  tax_amount: number;
  paid_amount: number;
  paid_date: string;
  status: 'paid' | 'pending' | 'overdue';
  receipt_number: string;
}

export interface ComplianceRule {
  id: string;
  category: ComplianceCategory;
  rule_name: string;
  description: string;
  applicable_zones: string[];
  applicable_property_types: string[];
  required_documents: string[];
  validation_criteria: string;
  penalty_for_violation: string;
  effective_from: string;
  effective_until: string;
}

export interface LoanPolicy {
  id: string;
  loan_type: LoanPurpose;
  min_amount: number;
  max_amount: number;
  min_tenure: number;
  max_tenure: number;
  base_interest_rate: number;
  max_ltv: number;
  max_foir: number;
  min_credit_score: number;
  eligible_employment_types: string[];
  required_documents: string[];
  processing_fee_percent: number;
  effective_from: string;
}