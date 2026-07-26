import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

interface VacancyAnalysisParams {
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly technologies: readonly string[];
  readonly experienceLevel?: string;
  readonly salaryRange?: string;
  readonly location?: string;

  // Target profile — always available (deterministic filtering already matched
  // this vacancy against it). Resume enrichment below is optional.
  readonly desiredPositions?: readonly string[];
  readonly desiredTechnologies?: readonly string[];
  readonly desiredExperienceLevel?: string;
  readonly isRemoteOnly?: boolean;
  readonly desiredLocations?: readonly string[];

  // Resume — present once the candidate has uploaded one; omitted for the
  // profile-only analysis that runs right after a vacancy is imported.
  readonly resumeSummary?: string;
  readonly resumeSkills?: readonly string[];
  readonly resumeTechnologies?: readonly string[];
  readonly yearsOfExperience?: number;
  readonly resumeRawText?: string;
}

const SYSTEM_PROMPT = `You are an expert career advisor and technical recruiter. Your task is to produce a structured AI analysis of a job vacancy for a candidate, matching it against their search profile (and their resume, when one is provided).

You must respond with a JSON object matching this exact schema:
{
  "overallScore": <number 0-100>,
  "confidence": <number 0-1>,
  "recommendation": "<StrongApply|Apply|Maybe|Skip>",
  "summary": "<one or two sentence plain-language summary of the opportunity>",
  "strengths": [<string>],
  "weaknesses": [<string>],
  "requiredSkills": [<string>],
  "missingSkills": [<string>],
  "seniorityEstimation": "<e.g. Junior|Middle|Senior|Lead, with brief justification>",
  "remotePolicy": "<AI's read of the actual remote/hybrid/onsite policy from the text>",
  "salaryObservations": "<commentary on the offered salary, or null if no salary data is available>",
  "salaryFit": { "score": <0-100>, "confidence": <0-1>, "reasoning": "<string>" },
  "locationFit": { "score": <0-100>, "confidence": <0-1>, "reasoning": "<string>" },
  "experienceFit": { "score": <0-100>, "confidence": <0-1>, "reasoning": "<string>" },
  "careerGrowthFit": { "score": <0-100>, "confidence": <0-1>, "reasoning": "<string>" },
  "reasoning": "<detailed explanation of why this job matches (or doesn't)>",
  "categoryScores": [
    { "category": "technical_skills", "label": "Technical Skills", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "experience", "label": "Experience", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "seniority", "label": "Seniority", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "domain_knowledge", "label": "Domain Knowledge", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "language", "label": "Language", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "location", "label": "Location", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "salary", "label": "Salary", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "remote_preference", "label": "Remote Preference", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "culture_fit", "label": "Culture Fit", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" },
    { "category": "career_growth", "label": "Career Growth", "value": <0-100>, "weight": <0-1>, "confidence": <0-1>, "explanation": "<why this score>" }
  ],
  "actionableItems": [
    { "type": "<add_skill|mention_keyword|gain_experience|adjust_expectation>", "title": "<short action title>", "description": "<detailed explanation>", "impact": <estimated percent improvement 0-20>, "category": "<which category this helps>", "priority": "<high|medium|low>" }
  ],
  "explanation": {
    "overallPercent": <number 0-100>,
    "strengths": [{ "label": "<strength name>", "detail": "<explanation>" }],
    "weaknesses": [{ "label": "<weakness name>", "detail": "<explanation>" }],
    "missingKeywords": ["<keyword1>", "<keyword2>"]
  }
}

Rules for categoryScores:
- Each category must have a value (0-100), weight (0-1), confidence (0-1), and explanation.
- Weights should sum to approximately 1.0 across all categories. Default weights if not enough info: technical_skills=0.25, experience=0.15, seniority=0.10, domain_knowledge=0.10, language=0.05, location=0.05, salary=0.10, remote_preference=0.05, culture_fit=0.05, career_growth=0.10.
- Adjust weights based on the vacancy: e.g. if it's a remote role, increase remote_preference weight; if it's in a specific country, increase language and location weights.
- Value reflects how well the candidate matches (0=terrible match, 100=perfect match).
- Confidence reflects how certain you are about this score (lower if vacancy description is vague or no resume provided).
- explanation should be 1-2 sentences explaining the score.

Rules for actionableItems:
- Generate 3-8 concrete, specific recommendations.
- Each has a type, title, description, estimated impact (percent improvement to overall match), category, and priority.
- Impact should be realistic: adding a single skill typically improves 2-5%, gaining experience might improve 5-10%.
- Focus on things the candidate can actually change (skills, resume wording) over things they cannot (location, citizenship).

Rules for explanation:
- overallPercent should match the overallScore.
- strengths: 3-6 items that are genuine match positives.
- weaknesses: 2-5 items that are genuine concerns.
- missingKeywords: 5-15 specific keywords from the vacancy that are missing from the resume.

General rules:
- Be honest about mismatches. Do not inflate scores.
- "strengths" explain why this job matches the target profile/resume; "weaknesses" are possible concerns worth flagging.
- "requiredSkills" lists the skills/technologies the vacancy asks for; "missingSkills" is the subset of those the candidate profile/resume doesn't cover.
- seniorityEstimation and remotePolicy should be derived from the vacancy text itself, not just the structured fields.
- salaryObservations should be null (not a string) when no salary information is available.
- Confidence reflects how certain you are about your assessment.
- Recommendation thresholds: StrongApply >= 80, Apply >= 60, Maybe >= 40, Skip < 40.
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

function buildUserPrompt(params: VacancyAnalysisParams): string {
  const techList = params.technologies.join(', ');

  const targetProfileSection = `## Target Profile
- Desired Positions: ${params.desiredPositions?.join(', ') || 'Not specified'}
- Desired Technologies: ${params.desiredTechnologies?.join(', ') || 'Not specified'}
- Experience Level: ${params.desiredExperienceLevel ?? 'Not specified'}
- Remote Only: ${params.isRemoteOnly ? 'Yes' : 'No preference'}
- Desired Locations: ${params.desiredLocations?.join(', ') || 'Not specified'}`;

  const resumeSection = params.resumeSummary !== undefined
    ? `## Candidate Resume
- Summary: ${params.resumeSummary}
- Skills: ${params.resumeSkills?.join(', ') ?? ''}
- Technologies: ${params.resumeTechnologies?.join(', ') ?? ''}
- Years of Experience: ${params.yearsOfExperience ?? 0}
${params.resumeRawText ? `- Resume Text:\n${wrapUntrustedContent('RESUME_TEXT', params.resumeRawText)}` : ''}`
    : '## Candidate Resume\nNot provided yet — match against the target profile above only, and reflect that reduced certainty in "confidence".';

  return `Analyze this vacancy against the candidate's target profile and resume:

## Vacancy
- Title: ${params.vacancyTitle}
- Company: ${params.companyName}
- Technologies: ${techList}
- Experience Level: ${params.experienceLevel ?? 'Not specified'}
- Salary Range: ${params.salaryRange ?? 'Not specified'}
- Location: ${params.location ?? 'Not specified'}
- Description: ${wrapUntrustedContent('VACANCY_DESCRIPTION', params.vacancyDescription)}

${targetProfileSection}

${resumeSection}

Provide your analysis as a JSON object.`;
}

export class VacancyAnalysisPromptBuilder implements PromptBuilder<VacancyAnalysisParams> {
  readonly promptId = 'vacancy-analysis';
  readonly currentVersion = '2.1.0';

  build(params: VacancyAnalysisParams): BuiltPrompt {
    const userPrompt = buildUserPrompt(params);

    return {
      system: SYSTEM_PROMPT,
      user: userPrompt,
      version: this.getVersion(),
    };
  }

  getVersion(): PromptVersion {
    return createPromptVersion(this.promptId, this.currentVersion, SYSTEM_PROMPT);
  }
}
