import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServerModule } from './server/server.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ServerModule],
})
export class AppModule {}
