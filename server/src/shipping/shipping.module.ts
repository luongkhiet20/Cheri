import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { ShippingMethodSchema } from './schemas/shipping.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ShippingMethod', schema: ShippingMethodSchema },
    ]),
  ],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
