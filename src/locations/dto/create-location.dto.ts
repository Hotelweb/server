import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLocationDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;
}
