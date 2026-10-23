import { IsInt, Min, Max, IsString, IsOptional, MaxLength } from 'class-validator';

export class RateRideDto {
  @IsInt({ message: 'Rating must be an integer' })
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must be at most 5' })
  rating: number;

  @IsOptional()
  @IsString({ message: 'Comment must be a string' })
  @MaxLength(500, { message: 'Comment must not exceed 500 characters' })
  comment?: string;
}
