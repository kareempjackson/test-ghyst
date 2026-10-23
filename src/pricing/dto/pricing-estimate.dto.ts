import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class PricingEstimateDto {
  @ApiProperty({ description: 'Origin zone ID' })
  @IsString()
  @IsNotEmpty()
  from_zone_id: string;

  @ApiProperty({ description: 'Destination zone ID' })
  @IsString()
  @IsNotEmpty()
  to_zone_id: string;
}
