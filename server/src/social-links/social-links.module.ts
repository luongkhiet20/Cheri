import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SocialLinksController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';
import SocialLinkSchema from './schemas/social-link.schema';
import UserSchema from '../auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'SocialLink',
        schema: SocialLinkSchema,
        collection: 'social_links',
      },
      {
        name: 'User',
        schema: UserSchema,
      },
    ]),
  ],
  controllers: [SocialLinksController],
  providers: [SocialLinksService],
  exports: [SocialLinksService],
})
export class SocialLinksModule {}

