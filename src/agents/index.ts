// ============================================
// Agent Exports and Orchestrator
// ============================================

export { BaseAgent, AgentFactory } from './BaseAgent.js';
export type { AgentConfig } from './BaseAgent.js';
export { PropertyVerificationAgent } from './PropertyVerificationAgent.js';
export { ComplianceAgent } from './ComplianceAgent.js';
export { FraudDetectionAgent } from './FraudDetectionAgent.js';
export { LoanEligibilityAgent } from './LoanEligibilityAgent.js';
export { DecisionAgent } from './DecisionAgent.js';

import { AgentFactory } from './BaseAgent.js';
import { PropertyVerificationAgent } from './PropertyVerificationAgent.js';
import { ComplianceAgent } from './ComplianceAgent.js';
import { FraudDetectionAgent } from './FraudDetectionAgent.js';
import { LoanEligibilityAgent } from './LoanEligibilityAgent.js';
import { DecisionAgent } from './DecisionAgent.js';
import type { 
  Property, 
  LoanApplication, 
  AgentTask, 
  AgentType 
} from '../types/index.js';

/**
 * Agent Orchestrator - Coordinates multi-agent workflow
 */
export class AgentOrchestrator {
  private initialized = false;

  constructor() {
    this.registerAgents();
  }

  private registerAgents(): void {
    AgentFactory.register(new PropertyVerificationAgent());
    AgentFactory.register(new ComplianceAgent());
    AgentFactory.register(new FraudDetectionAgent());
    AgentFactory.register(new LoanEligibilityAgent());
    AgentFactory.register(new DecisionAgent());
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[AgentOrchestrator] Initializing all agents...');
    await AgentFactory.initializeAll();
    this.initialized = true;
    console.log('[AgentOrchestrator] All agents initialized successfully');
  }

  /**
   * Run complete property verification workflow
   */
  async runPropertyVerification(
    property: Property,
    options: {
      landRecords?: unknown[];
      taxRecords?: unknown[];
      complianceRules?: unknown[];
    } = {}
  ): Promise<{
    propertyVerification: AgentTask;
    compliance: AgentTask;
    fraudDetection: AgentTask;
    decision: AgentTask;
    processingTime: number;
  }> {
    await this.initialize();
    const startTime = Date.now();

    console.log('[AgentOrchestrator] Starting property verification workflow...');

    // Run property verification, compliance, and fraud detection in parallel
    const [propertyVerificationResult, complianceResult, fraudDetectionResult] = await Promise.all([
      this.runAgent('property_verification', {
        property,
        landRecords: options.landRecords,
      }),
      this.runAgent('compliance', {
        property,
        taxRecords: options.taxRecords,
        complianceRules: options.complianceRules,
      }),
      this.runAgent('fraud_detection', {
        property,
        landRecords: options.landRecords,
      }),
    ]);

    // Run decision agent with aggregated results
    const decisionResult = await this.runAgent('decision', {
      property,
      propertyVerificationResult,
      complianceResult,
      fraudDetectionResult,
    });

    const processingTime = Date.now() - startTime;
    console.log(`[AgentOrchestrator] Property verification completed in ${processingTime}ms`);

    return {
      propertyVerification: propertyVerificationResult,
      compliance: complianceResult,
      fraudDetection: fraudDetectionResult,
      decision: decisionResult,
      processingTime,
    };
  }

  /**
   * Run complete loan application workflow
   */
  async runLoanApplication(
    loanApplication: LoanApplication,
    options: {
      landRecords?: unknown[];
      taxRecords?: unknown[];
      complianceRules?: unknown[];
      loanPolicies?: unknown[];
      propertyValue?: number;
    } = {}
  ): Promise<{
    propertyVerification: AgentTask;
    compliance: AgentTask;
    fraudDetection: AgentTask;
    loanEligibility: AgentTask;
    decision: AgentTask;
    processingTime: number;
  }> {
    await this.initialize();
    const startTime = Date.now();

    console.log('[AgentOrchestrator] Starting loan application workflow...');

    const { property, applicant, loanDetails } = loanApplication;

    // Run all verification agents in parallel
    const [
      propertyVerificationResult,
      complianceResult,
      fraudDetectionResult,
      loanEligibilityResult
    ] = await Promise.all([
      this.runAgent('property_verification', {
        property,
        landRecords: options.landRecords,
      }),
      this.runAgent('compliance', {
        property,
        taxRecords: options.taxRecords,
        complianceRules: options.complianceRules,
      }),
      this.runAgent('fraud_detection', {
        property,
        landRecords: options.landRecords,
      }),
      this.runAgent('loan_eligibility', {
        applicant,
        property,
        loanDetails,
        loanPolicies: options.loanPolicies,
        propertyValue: options.propertyValue,
      }),
    ]);

    // Run decision agent with all results
    const decisionResult = await this.runAgent('decision', {
      property,
      loanApplication,
      propertyVerificationResult,
      complianceResult,
      fraudDetectionResult,
      loanEligibilityResult,
    });

    const processingTime = Date.now() - startTime;
    console.log(`[AgentOrchestrator] Loan application workflow completed in ${processingTime}ms`);

    return {
      propertyVerification: propertyVerificationResult,
      compliance: complianceResult,
      fraudDetection: fraudDetectionResult,
      loanEligibility: loanEligibilityResult,
      decision: decisionResult,
      processingTime,
    };
  }

  /**
   * Run a single agent
   */
  async runAgent(agentType: AgentType, input: Record<string, unknown>): Promise<AgentTask> {
    const agent = AgentFactory.get(agentType);
    if (!agent) {
      throw new Error(`Agent not found: ${agentType}`);
    }
    return agent.execute(input);
  }

  /**
   * Get all registered agents info
   */
  getAgentsInfo(): Array<{ type: AgentType; name: string; capabilities: string[] }> {
    return AgentFactory.getAll().map(agent => {
      const info = agent.getInfo();
      return {
        type: info.type,
        name: info.name,
        capabilities: info.capabilities,
      };
    });
  }
}

// Export singleton instance
export const orchestrator = new AgentOrchestrator();