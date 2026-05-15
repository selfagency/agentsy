import type { Skill } from '../types/index.js';

export interface SkillMatchResult {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  proficiencyGaps: Array<{
    skill: string;
    required: string;
    available: string;
  }>;
}

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const SkillProfiler: Record<ProficiencyLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4
};

function compareProficiency(required: string, available: string): number {
  const prof = available as ProficiencyLevel;
  const req = required as ProficiencyLevel;
  return (SkillProfiler[prof] ?? 0) - (SkillProfiler[req] ?? 0);
}

function getProficiencyLevel(proficiency: string): number {
  const prof = proficiency as ProficiencyLevel;
  return SkillProfiler[prof] || 0;
}

export function matchRequirements(required: Skill[], available: Skill[]): SkillMatchResult {
  const skillMap = new Map(available.map(skill => [skill.name, skill]));
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const proficiencyGaps: Array<{
    skill: string;
    required: string;
    available: string;
  }> = [];

  let totalScore = 0;

  for (const req of required) {
    const availableSkill = skillMap.get(req.name);
    if (availableSkill) {
      matchedSkills.push(req.name);

      const proficiencyGap = compareProficiency(req.proficiency, availableSkill.proficiency);
      if (proficiencyGap < 0) {
        proficiencyGaps.push({
          skill: req.name,
          required: req.proficiency,
          available: availableSkill.proficiency
        });
      }

      // Calculate proficiency score
      const reqLevel = getProficiencyLevel(req.proficiency);
      const availLevel = getProficiencyLevel(availableSkill.proficiency);
      const score = Math.min(availLevel / reqLevel, 1);
      totalScore += score;
    } else {
      missingSkills.push(req.name);
    }
  }

  const averageScore = required.length > 0 ? totalScore / required.length : 0;

  return {
    score: averageScore,
    matchedSkills,
    missingSkills,
    proficiencyGaps
  };
}

export function findBestMatches(
  requirements: Skill[],
  candidates: Array<{ id: string; skills: Skill[]; score?: number }>
): Array<{ id: string; score: number; match: SkillMatchResult }> {
  return candidates
    .map(candidate => ({
      id: candidate.id,
      score: 0,
      match: matchRequirements(requirements, candidate.skills)
    }))
    .map(item => ({
      ...item,
      score: item.match.score
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}
