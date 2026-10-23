import { ApiProperty } from '@nestjs/swagger';

export class ZoneResponseDto {
  @ApiProperty({ description: 'Unique zone identifier' })
  id: string;

  @ApiProperty({ description: 'Display name of the zone', example: 'New Kingston' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'new-kingston' })
  slug: string;
}
