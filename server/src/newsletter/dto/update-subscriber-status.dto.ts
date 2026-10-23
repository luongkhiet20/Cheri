import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateSubscriberStatusDto {
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  @IsString({ message: 'Trạng thái phải là chuỗi ký tự' })
  @IsIn(['SUBSCRIBED', 'UNSUBSCRIBED'], {
    message: 'Trạng thái không hợp lệ. Chỉ chấp nhận SUBSCRIBED hoặc UNSUBSCRIBED',
  })
  status: 'SUBSCRIBED' | 'UNSUBSCRIBED';
}
