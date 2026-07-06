// ============================================
// Base Agent Class for Multi-Agent System
// ============================================

import type { 
  AgentTask, 
  AgentTaskResult, 
  AgentType
} from '../types/index.js';

// Simple UUID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface AgentConfig {
  name: string;
  description: string;
  capabilities: string[];
  maxRetries: number;
  timeout: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected agentType: AgentType;
  protected isInitialized: boolean = false;

  constructor(agentType: AgentType, config: AgentConfig) {
    this.agentType = agentType;
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log(`[${this.config.name}] Initializing agent...`);
    await this.onInitialize();
    this.isInitialized = true;
    console.log(`[${this.config.name}] Agent initialized successfully`);
  }

  protected abstract onInitialize(): Promise<void>;

  async execute(input: Record<string, unknown>): Promise<AgentTask> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const task: AgentTask = {
      id: generateId(),
      agentType: this.agentType,
      input,
      status: 'pending',
      startedAt: new Date(),
    };

    try {
      task.status = 'running';
      console.log(`[${this.config.name}] Starting task ${task.id}`);

      const result = await this.executeWithRetry(input);
      
      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();
      
      console.log(`[${this.config.name}] Task ${task.id} completed successfully`);
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.completedAt = new Date();
      
      console.error(`[${this.config.name}] Task ${task.id} failed:`, task.error);
    }

    return task;
  }

  private async executeWithRetry(input: Record<string, unknown>): Promise<AgentTaskResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          this.process(input),
          this.timeout(this.config.timeout),
        ]);
        
        return result as AgentTaskResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[${this.config.name}] Attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < this.config.maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError || new Error('Task failed after all retries');
  }

  protected abstract process(input: Record<string, unknown>): Promise<AgentTaskResult>;

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Task timed out after ${ms}ms`)), ms);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getInfo(): AgentConfig & { type: AgentType; initialized: boolean } {
    return {
      ...this.config,
      type: this.agentType,
      initialized: this.isInitialized,
    };
  }

  protected generateReasoning(findings: string[], conclusion: string): string {
    const reasoning = [
      `## Analysis by ${this.config.name}`,
      '',
      '### Findings:',
      ...findings.map((f, i) => `${i + 1}. ${f}`),
      '',
      '### Conclusion:',
      conclusion,
    ];
    return reasoning.join('\n');
  }

  protected formatRecommendations(
    items: Array<{ priority: 'high' | 'medium' | 'low'; action: string }>
  ): string[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return items
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .map(item => `[${item.priority.toUpperCase()}] ${item.action}`);
  }
}

export class AgentFactory {
  private static agents: Map<AgentType, BaseAgent> = new Map();

  static register(agent: BaseAgent): void {
    const info = agent.getInfo();
    this.agents.set(info.type, agent);
    console.log(`[AgentFactory] Registered agent: ${info.name}`);
  }

  static get(type: AgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  static getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  static async initializeAll(): Promise<void> {
    console.log('[AgentFactory] Initializing all agents...');
    const initPromises = Array.from(this.agents.values()).map(agent => 
      agent.initialize().catch(err => {
        console.error(`Failed to initialize agent:`, err);
      })
    );
    await Promise.all(initPromises);
    console.log('[AgentFactory] All agents initialized');
  }
}