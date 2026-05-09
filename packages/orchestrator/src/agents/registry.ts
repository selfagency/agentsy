import type { AgentCapabilities } from '../types/index.js';
import { EventEmitter } from 'node:events';

export class AgentRegistry extends EventEmitter {
  private readonly agents = new Map<string, AgentCapabilities>();
  private readonly skillMap = new Map<string, Set<string>>();
  private readonly resourceMap = new Map<string, Map<string, number>>();

  register(agent: AgentCapabilities): void {
    this.agents.set(agent.id, agent);

    // Update skill mapping
    agent.skills.forEach(skill => {
      if (!this.skillMap.has(skill.name)) {
        this.skillMap.set(skill.name, new Set());
      }
      const skillAgents = this.skillMap.get(skill.name);
      if (skillAgents) {
        skillAgents.add(agent.id);
      }
    });

    // Update resource mapping
    agent.maxConcurrency = agent.maxConcurrency || 1;

    this.emit('agent:registered', agent);
  }

  unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);

      // Update skill mapping
      agent.skills.forEach(skill => {
        const agents = this.skillMap.get(skill.name);
        if (agents) {
          agents.delete(agentId);
          if (agents.size === 0) {
            this.skillMap.delete(skill.name);
          }
        }
      });

      this.emit('agent:unregistered', agentId);
    }
  }

  getAgent(agentId: string): AgentCapabilities | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentCapabilities[] {
    return Array.from(this.agents.values());
  }

  findAgentsBySkill(skillName: string): AgentCapabilities[] {
    const agentIds = this.skillMap.get(skillName);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is AgentCapabilities => agent !== undefined && agent.available);
  }

  findAgentsBySkills(requiredSkills: RequiredSkills[]): AgentCapabilities[] {
    if (requiredSkills.length === 0) {
      return this.getAllAgents().filter(agent => agent.available);
    }

    const firstSkill = requiredSkills[0];
    if (!firstSkill) return [];

    const candidateAgents = this.findAgentsBySkill(firstSkill.name);

    return candidateAgents.filter(agent => {
      const agentSkills = new Map(agent.skills.map(skill => [skill.name, skill.proficiency]));

      return requiredSkills.every(requiredSkill => {
        const agentSkill = agentSkills.get(requiredSkill.name);
        return agentSkill && this.isProficientEnough(agentSkill, requiredSkill.proficiency);
      });
    });
  }

  updateAvailability(agentId: string, available: boolean): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.available = available;
      agent.lastSeen = new Date();
      this.emit('agent:updated', agent);
    }
  }

  private isProficientEnough(agentProficiency: string, requiredProficiency: string): boolean {
    const levels: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };

    return (levels[agentProficiency] ?? 0) >= (levels[requiredProficiency] ?? 0);
  }
}

interface RequiredSkills {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}
