import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { PublicGamesController } from './public-games.controller';

@Module({
  providers: [GamesService],
  controllers: [GamesController, PublicGamesController],
  exports: [GamesService],
})
export class GamesModule {}
