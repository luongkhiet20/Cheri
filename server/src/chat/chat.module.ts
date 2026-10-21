import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatbotService } from './services/chatbot.service';
import { ChatbotAiService } from './services/chatbot-ai.service';
import { ChatbotIntentService } from './services/chatbot-intent.service';
import { ChatbotProductService } from './services/chatbot-product.service';
import { ChatbotModerationService } from './services/chatbot-moderation.service';
import { ChatbotKnowledgeService } from './services/chatbot-knowledge.service';
import { ChatbotSessionService } from './services/chatbot-session.service';
import { ChatbotSessionSchema } from './schemas/chatbot-session.schema';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import ProductSchema from '../products/schemas/product.schema';
import ProductVariantSchema from '../products/schemas/product-variant.schema';
import OrderSchema from '../orders/schemas/order.schema';
import PageSchema from '../cheri/schemas/page.schema';
import { InteractionSchema } from '../interactions/schemas/interaction.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'ProductVariant', schema: ProductVariantSchema },
      { name: 'Order', schema: OrderSchema },
      { name: 'Page', schema: PageSchema },
      { name: 'Interaction', schema: InteractionSchema },
      { name: 'ChatbotSession', schema: ChatbotSessionSchema },
    ]),
    ProductsModule,
    OrdersModule,
    RecommendationsModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatbotAiService,
    ChatbotIntentService,
    ChatbotProductService,
    ChatbotModerationService,
    ChatbotKnowledgeService,
    ChatbotSessionService,
    ChatbotService,
    ChatService,
  ],
  exports: [
    ChatbotService,
    ChatService,
    ChatbotAiService,
    ChatbotIntentService,
    ChatbotProductService,
    ChatbotModerationService,
    ChatbotKnowledgeService,
    ChatbotSessionService,
  ],
})
export class ChatModule {}
