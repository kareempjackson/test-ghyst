import { ApiProperty } from '@nestjs/swagger';

class ZoneInfoDto {
  @ApiProperty({ description: 'Zone ID' })
  id: string;

  @ApiProperty({ description: 'Zone name' })
  name: string;
}

export class PricingResponseDto {
  @ApiProperty({ description: 'Origin zone information' })
  from_zone: ZoneInfoDto;

  @ApiProperty({ description: 'Destination zone information' })
  to_zone: ZoneInfoDto;

  @ApiProperty({ description: 'Fare amount in cents', example: 550 })
  fare_cents: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Formatted fare for display', example: '$5.50' })
  fare_display: string;
}
