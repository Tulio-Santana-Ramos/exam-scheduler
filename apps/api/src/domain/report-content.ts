import { InvalidInputError } from './errors.js';

const LIMITS = { title: 200, body: 50_000, professionalName: 200 } as const;

export interface ReportContentInput {
  title: string;
  body: string;
  professionalName: string;
}

export class ReportContent {
  private constructor(
    readonly title: string,
    readonly body: string,
    readonly professionalName: string,
  ) {}

  static create(input: ReportContentInput): ReportContent {
    return new ReportContent(
      ReportContent.field('title', input.title),
      ReportContent.field('body', input.body),
      ReportContent.field('professionalName', input.professionalName),
    );
  }

  private static field(name: keyof typeof LIMITS, value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) throw new InvalidInputError(`${name} is required`);
    if (trimmed.length > LIMITS[name]) {
      throw new InvalidInputError(`${name} must have at most ${LIMITS[name]} characters`);
    }
    return trimmed;
  }
}
