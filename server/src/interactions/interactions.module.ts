import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { InteractionSchema } from './schemas/interaction.schema';
import ProductSchema from '../products/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Interaction', schema: InteractionSchema, collection: 'user_interactions' },
      { name: 'Product', schema: ProductSchema },
    ]),
  ],
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
