import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CancelRideDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
