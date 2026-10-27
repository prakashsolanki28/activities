import { Controller, Get, Param } from '@nestjs/common';
import { GamesService } from './games.service';

/** The projector display. No auth: the payload is built answer-safe by buildPublicDisplay. */
@Controller('public/games')
export class PublicGamesController {
  constructor(private readonly games: GamesService) {}

  @Get(':code')
  display(@Param('code') code: string) {
    return this.games.publicDisplay(code);
  }
}
