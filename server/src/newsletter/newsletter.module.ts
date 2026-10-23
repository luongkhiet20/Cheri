import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import NewsletterSubscriberSchema from './schemas/newsletter-subscriber.schema';
import UserSchema from '../auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'NewsletterSubscriber',
        schema: NewsletterSubscriberSchema,
        collection: 'newsletter_subscribers',
      },
      {
        name: 'User',
        schema: UserSchema,
      },
    ]),
  ],
  controllers: [NewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
