import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationImpressionSchema } from './schemas/recommendation-impression.schema';
import { InteractionSchema } from '../interactions/schemas/interaction.schema';

@Module({
  imports: [
    ProductsModule,
    MongooseModule.forFeature([
      {
        name: 'RecommendationImpression',
        schema: RecommendationImpressionSchema,
        collection: 'recommendation_impressions',
      },
      {
        name: 'Interaction',
        schema: InteractionSchema,
        collection: 'user_interactions',
      },
    ]),
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
