import { Document } from 'mongoose';

export type PageAboutStatus = 'draft' | 'published';

export interface PageAbout extends Document {
  _id: string;
  key: string;
  status: PageAboutStatus;
  version: number;
  sections: any[];
  publishedAt?: Date;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
