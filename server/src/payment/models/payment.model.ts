export interface PaymentMethod {
  _id?: string;
  name: string;
  code: string;
  paymentType: string;
  type?: string;
  paymentInfo?: string;
  description: string;
  transactionFee: {
    enabled: boolean;
    type: 'FIXED' | 'PERCENT';
    value: number;
  };
  logo: string;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: Date;
  updatedAt?: Date;
}
