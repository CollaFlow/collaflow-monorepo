import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServerModule } from './server/server.module';
import { CollabModule } from './collab/collab.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServerModule,
    CollabModule,
  ],
})
export class AppModule {}
