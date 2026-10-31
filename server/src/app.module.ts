import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { TranslationsModule } from './translations/translations.module';
import { AdminModule } from './admin/admin.module';
import { CheriModule } from './cheri/cheri.module';
import { InteractionsModule } from './interactions/interactions.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ChatModule } from './chat/chat.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { SocialLinksModule } from './social-links/social-links.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGO_URI') || process.env.MONGO_URI;
        if (!uri) {
          throw new Error('Thiếu cấu hình biến môi trường bắt buộc: MONGO_URI');
        }
        return { uri };
      },
      inject: [ConfigService],
    }),
    ProductsModule,
    CartModule,
    OrdersModule,
    TranslationsModule,
    AuthModule,
    AdminModule,
    CheriModule,
    InteractionsModule,
    RecommendationsModule,
    ReviewsModule,
    ChatModule,
    NewsletterModule,
    SocialLinksModule,
  ],
  exports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
