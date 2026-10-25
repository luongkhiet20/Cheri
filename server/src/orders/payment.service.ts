import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types, isValidObjectId } from 'mongoose';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import {
  PaymentTransactionStatus,
} from './schemas/payment-transaction.schema';

interface CreateTransactionInput {
  orderId: Types.ObjectId;
  orderCode: string;
  provider: string;
  method: string;
  amount: number;
  currency: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe?: Stripe;

  constructor(
    @InjectModel('PaymentTransaction')
    private readonly transactionModel: Model<any>,
  ) {
    const secret = process.env.STRIPE_SECRETKEY?.trim();
    if (secret) {
      this.stripe = new Stripe(secret, { apiVersion: '2020-08-27' });
    }
  }

  async createPending(input: CreateTransactionInput): Promise<any> {
    return this.transactionModel.create({
      ...input,
      status: PaymentTransactionStatus.PENDING,
    });
  }

  async markFailed(transactionId: Types.ObjectId, reason: string, session?: ClientSession): Promise<boolean> {
    const result = await this.transactionModel.updateOne(
      { _id: transactionId, status: PaymentTransactionStatus.PENDING },
      {
        $set: {
          status: PaymentTransactionStatus.FAILED,
          failureReason: reason.slice(0, 500),
        },
      },
      { session },
    );
    return result.modifiedCount === 1;
  }

  async chargeCard(
    amount: number,
    currency: string,
    source: string,
    orderCode: string,
  ): Promise<{ providerTransactionId: string; paymentLink: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Thanh toán online chưa được cấu hình Stripe.');
    }
    if (!source?.trim()) {
      throw new BadRequestException('Thiếu thông tin thẻ thanh toán.');
    }

    const charge = await this.stripe.charges.create({
      amount: Math.round(amount),
      currency: currency.toLowerCase(),
      description: `Chéri order ${orderCode}`,
      source: source.trim(),
      capture: false,
      metadata: { orderCode },
    });

    try {
      const captured = await this.stripe.charges.capture(charge.id);
      if (captured.status !== 'succeeded') {
        throw new Error(`Stripe charge status: ${captured.status}`);
      }
    } catch (error) {
      try {
        await this.stripe.refunds.create({ charge: charge.id });
      } catch (refundError) {
        this.logger.error(
          `Stripe charge ${charge.id} failed and automatic refund also failed: ${refundError.message}`,
        );
      }
      throw error;
    }

    return { providerTransactionId: charge.id, paymentLink: '' };
  }

  async markPaid(
    transactionId: Types.ObjectId,
    providerTransactionId: string,
    paymentLink = '',
    session?: ClientSession,
  ): Promise<boolean> {
    const result = await this.transactionModel.updateOne(
      { _id: transactionId, status: PaymentTransactionStatus.PENDING },
      {
        $set: {
          status: PaymentTransactionStatus.PAID,
          providerTransactionId,
          paymentLink,
          paidAt: new Date(),
          failureReason: '',
        },
      },
      { session },
    );
    return result.modifiedCount === 1;
  }

  async createVnpayPayment(
    input: CreateTransactionInput,
    clientIp: string,
  ): Promise<{ transaction: any; paymentUrl: string }> {
    const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
    const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
    const paymentUrl =
      process.env.VNPAY_PAYMENT_URL?.trim() ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const returnUrl =
      process.env.VNPAY_RETURN_URL?.trim() ||
      `${process.env.SERVER_URL || 'http://localhost:4000'}/api/orders/payment/vnpay/return`;

    if (!tmnCode || !hashSecret) {
      throw new BadRequestException('Thanh toán VNPAY chưa được cấu hình.');
    }
    if (input.currency !== 'VND' || !Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException('VNPAY yêu cầu số tiền VND nguyên dương.');
    }

    const transaction = await this.createPending({
      ...input,
      provider: 'VNPAY',
    });
    const txnRef = String(transaction._id);
    const createdAt = new Date();
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: String(Math.round(input.amount * 100)),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan don hang ${input.orderCode}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: this.normalizeClientIp(clientIp),
      vnp_CreateDate: this.formatVnpayDate(createdAt),
      vnp_ExpireDate: this.formatVnpayDate(new Date(createdAt.getTime() + 15 * 60 * 1000)),
    };

    const query = this.buildVnpayQuery(params);
    const secureHash = crypto
      .createHmac('sha512', hashSecret)
      .update(query, 'utf8')
      .digest('hex');
    const finalUrl = `${paymentUrl}?${query}&vnp_SecureHash=${secureHash}`;

    await this.transactionModel.updateOne(
      { _id: transaction._id },
      { $set: { providerTransactionId: txnRef, paymentLink: finalUrl } },
    );

    return { transaction, paymentUrl: finalUrl };
  }

  verifyVnpayResponse(query: Record<string, string>): boolean {
    const secret = process.env.VNPAY_HASH_SECRET?.trim();
    const receivedHash = String(query?.vnp_SecureHash || '').toLowerCase();
    if (!secret || !/^[a-f0-9]{128}$/.test(receivedHash)) return false;

    const signedParams = Object.keys(query)
      .filter((key) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
      .reduce<Record<string, string>>((result, key) => {
        result[key] = String(query[key]);
        return result;
      }, {});
    const expectedHash = crypto
      .createHmac('sha512', secret)
      .update(this.buildVnpayQuery(signedParams), 'utf8')
      .digest('hex')
      .toLowerCase();

    return receivedHash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expectedHash));
  }

  async getTransactionByProviderId(providerTransactionId: string, session?: ClientSession): Promise<any> {
    // vnp_TxnRef is our immutable transaction _id; the provider ID changes after payment.
    if (!isValidObjectId(providerTransactionId)) return null;
    return this.transactionModel.findOne({
      provider: 'VNPAY',
      _id: new Types.ObjectId(providerTransactionId),
    }, null, { session });
  }

  async getPendingVnpayTransactions(before: Date, after: Date): Promise<any[]> {
    return this.transactionModel.find({
      provider: 'VNPAY',
      status: PaymentTransactionStatus.PENDING,
      createdAt: { $lte: before, $gte: after },
    }).sort({ createdAt: 1 }).limit(10).lean();
  }

  async queryVnpayTransaction(transaction: any): Promise<Record<string, string>> {
    const secret = process.env.VNPAY_HASH_SECRET?.trim();
    const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
    const endpoint = process.env.VNPAY_QUERY_URL?.trim() ||
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
    if (!secret || !tmnCode || !isValidObjectId(transaction?._id)) {
      throw new BadRequestException('Missing VNPAY query configuration or transaction.');
    }
    const url = new URL(transaction.paymentLink || 'https://invalid.local');
    const transactionDate = url.searchParams.get('vnp_CreateDate');
    if (!/^\d{14}$/.test(transactionDate || '')) {
      throw new BadRequestException('Missing original VNPAY transaction date.');
    }
    const request: Record<string, string> = {
      vnp_RequestId: crypto.randomBytes(16).toString('hex'),
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: tmnCode,
      vnp_TxnRef: String(transaction._id),
      vnp_TransactionDate: transactionDate,
      vnp_CreateDate: this.formatVnpayDate(new Date()),
      vnp_IpAddr: process.env.VNPAY_SERVER_IP?.trim() || '127.0.0.1',
      vnp_OrderInfo: `Tra cuu don hang ${transaction.orderCode}`,
    };
    request.vnp_SecureHash = this.signVnpayFields(request, [
      'vnp_RequestId', 'vnp_Version', 'vnp_Command', 'vnp_TmnCode',
      'vnp_TxnRef', 'vnp_TransactionDate', 'vnp_CreateDate', 'vnp_IpAddr', 'vnp_OrderInfo',
    ], secret);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`VNPAY query HTTP ${response.status}`);
    const result = await response.json() as Record<string, unknown>;
    const fields = [
      'vnp_ResponseId', 'vnp_Command', 'vnp_ResponseCode', 'vnp_Message',
      'vnp_TmnCode', 'vnp_TxnRef', 'vnp_Amount', 'vnp_BankCode',
      'vnp_PayDate', 'vnp_TransactionNo', 'vnp_TransactionType',
      'vnp_TransactionStatus', 'vnp_OrderInfo', 'vnp_PromotionCode', 'vnp_PromotionAmount',
    ];
    const returned = Object.fromEntries(Object.entries(result).map(([key, value]) => [key, String(value ?? '')]));
    const hash = String(returned.vnp_SecureHash || '').toLowerCase();
    const expected = this.signVnpayFields(returned, fields, secret);
    if (!/^[a-f0-9]{128}$/.test(hash) ||
        !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected)) ||
        (returned.vnp_Command && returned.vnp_Command !== 'querydr') ||
        returned.vnp_TmnCode !== tmnCode ||
        // Phản hồi lỗi (vd. 91 - không tìm thấy giao dịch) có thể không kèm mã/số tiền giao dịch.
        ((returned.vnp_ResponseCode === '00' || returned.vnp_TxnRef) &&
          returned.vnp_TxnRef !== String(transaction._id)) ||
        (returned.vnp_ResponseCode === '00' &&
          returned.vnp_Amount !== String(Number(transaction.amount) * 100))) {
      throw new Error('Invalid VNPAY query response signature or transaction details.');
    }
    return returned;
  }

  private signVnpayFields(values: Record<string, string>, fields: string[], secret: string): string {
    return crypto.createHmac('sha512', secret)
      .update(fields.map(key => values[key] || '').join('|'), 'utf8')
      .digest('hex');
  }

  private buildVnpayQuery(params: Record<string, string>): string {
    // VNPAY 2.1.0 signs form-encoded values: spaces must be '+' rather than '%20'.
    const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, '+');
    return Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .map((key) => `${encode(key)}=${encode(params[key])}`)
      .join('&');
  }

  private formatVnpayDate(date: Date): string {
    const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${vietnamTime.getUTCFullYear()}${pad(vietnamTime.getUTCMonth() + 1)}${pad(vietnamTime.getUTCDate())}` +
      `${pad(vietnamTime.getUTCHours())}${pad(vietnamTime.getUTCMinutes())}${pad(vietnamTime.getUTCSeconds())}`;
  }

  private normalizeClientIp(value: string): string {
    const ip = String(value || '').split(',')[0].trim();
    if (!ip) return '127.0.0.1';
    return ip === '::1' ? '127.0.0.1' : ip.replace(/^::ffff:/, '');
  }
}
