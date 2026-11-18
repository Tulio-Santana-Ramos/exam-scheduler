import { ReportAlreadyPublishedError } from './errors.js';
import type { ReportContent } from './report-content.js';

export type ReportStatus = 'DRAFT' | 'PUBLISHED';

export interface ReportProps {
  id: string;
  appointmentId: string;
  content: ReportContent;
  status: ReportStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Report {
  private constructor(private readonly props: ReportProps) {}

  static draft(id: string, appointmentId: string, content: ReportContent, now: Date): Report {
    return new Report({
      id,
      appointmentId,
      content,
      status: 'DRAFT',
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: ReportProps): Report {
    return new Report(props);
  }

  get id(): string {
    return this.props.id;
  }
  get appointmentId(): string {
    return this.props.appointmentId;
  }
  get content(): ReportContent {
    return this.props.content;
  }
  get status(): ReportStatus {
    return this.props.status;
  }
  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get isPublished(): boolean {
    return this.props.status === 'PUBLISHED';
  }

  withContent(content: ReportContent, now: Date): Report {
    this.assertEditable();
    return new Report({ ...this.props, content, updatedAt: now });
  }

  publish(now: Date): Report {
    this.assertEditable();
    return new Report({ ...this.props, status: 'PUBLISHED', publishedAt: now, updatedAt: now });
  }

  private assertEditable(): void {
    if (this.isPublished) throw new ReportAlreadyPublishedError();
  }
}
