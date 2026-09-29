export interface ShippingMethod {
  _id?: string;
  name: string;
  code: string;
  baseCost: number;
  estimatedDays: string;
  coverageArea: 'national' | 'regional';
  freeShippingThreshold: number;
  isActive: boolean;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}
