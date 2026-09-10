import { Module, Global } from '@nestjs/common';
import { CollabService } from './collab.service';

@Global()
@Module({
  providers: [CollabService],
  exports: [CollabService],
})
export class CollabModule {}
