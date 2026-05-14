import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum SenderType {
    customer = 'customer',
    admin = 'admin',
}

export class CreateMessageDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    content: string;

    @IsString()
    @IsNotEmpty()
    locationId: string;

    @IsEnum(SenderType)
    senderType: SenderType;
}
