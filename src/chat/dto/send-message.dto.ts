import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum SenderType {
    customer = 'customer',
    admin = 'admin',
}

export class SendMessageDto {
    @IsString()
    @IsNotEmpty()
    locationId: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    content: string;

    @IsEnum(SenderType)
    senderType: SenderType;
}
