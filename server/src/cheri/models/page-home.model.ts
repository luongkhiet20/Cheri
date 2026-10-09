import { Document } from 'mongoose';

export type PageHomeStatus = 'draft' | 'published';

export interface PageHome extends Document {
  _id: string;
  key: string;
  status: PageHomeStatus;
  version: number;
  sections: any[];
  publishedAt?: Date;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
